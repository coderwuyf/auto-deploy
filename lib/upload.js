let rootPath = "";
let CONFIG = {};
const chalk = require("chalk"); // 命令行颜色
const ora = require("ora"); // 加载流程动画
const spinner_style = require("./spinner_style.js"); // 加载动画样式
const shell = require("shelljs"); // 执行shell命令
const { NodeSSH } = require("node-ssh"); // ssh连接服务器
const inquirer = require("inquirer"); // 命令行交互
const path = require("path"); // nodejs内置路径模块
const SSH = new NodeSSH();
let config; // 用于保存 inquirer 命令行交互后选择正式|测试版的配置
const errorLog = (log) => console.log(chalk.red(`---------------- ${log} ----------------`));
const successLog = (log) => console.log(chalk.green(`---------------- ${log} ----------------`));

function findRootPath() {
  return new Promise((resolve) => {
    shell.exec("npm root", { silent: true, async: false }, (_, res) => {
      resolve(path.resolve(res, "../"));
    });
  });
}

// 01开始前的配置检查
/**
 *
 * @param {Object} conf 配置对象
 */
function checkConfig(conf) {
  const checkArr = Object.entries(conf);
  checkArr.map((it) => {
    const key = it[0];
    if (key === "PATH" && conf[key] === "/") {
      errorLog("PATH 不能是服务器根目录!");
      process.exit(); // 退出流程
    }
    if (!conf[key]) {
      errorLog(`配置项 ${key} 不能为空`);
      process.exit(); // 退出流程
    }
  });
}

// 02项目打包代码 npm run build
async function compileDist() {
  return new Promise((resolve, reject) => {
    const loading = ora({
      text: "项目正在打包中...",
      spinner: spinner_style.grenade,
    }).start();
    shell.cd(path.resolve(__dirname, rootPath));
    shell.exec(config.buildScripts, { async: true, silent: true }, (code) => {
      if (code === 0) {
        loading.succeed("项目打包成功!");
        resolve();
      } else {
        loading.fail("项目打包失败, 请重试!");
        reject("项目打包失败");
      }
    }); // 执行shell 打包命令
  });
}

// 03提交代码到svn
function submitCodeToSVN(comment) {
  return new Promise((resolve, reject) => {
    const loading = ora({
      text: "检测代码变更...",
      spinner: spinner_style.grenade,
    }).start();
    shell.cd(path.resolve(__dirname, rootPath + "/" + config.FOLDER));
    shell.exec("svn add . --force", { silent: true });
    shell.cd(path.resolve(__dirname, rootPath));
    shell.exec("svn add . --force", { silent: true });
    shell.exec("svn status", { silent: true, async: true }, (_, res) => {
      const reg = /![\s\S]*?\s*(?:\n|$)/gi;
      let promiseArr = [];
      if (res.match(reg)) {
        promiseArr = res.match(reg).map((item) => {
          return new Promise((resolve) => {
            shell.exec(
              `svn rm ${path.resolve(__dirname, rootPath)}/${item.match(/\s(\S*)\r\n/)[1]}`,
              {
                silent: true,
                async: true,
              },
              () => {
                resolve();
              }
            );
          });
        });
      }
      Promise.all(promiseArr).finally(() => {
        loading.succeed("检测代码变更处理完成");
        // 执行shell 提交代码至svn
        const loading1 = ora({
          text: "正在提交代码...",
          spinner: spinner_style.grenade,
        }).start();
        shell.exec(`svn ci -m "${comment}"`, { async: true, silent: true }, async (code) => {
          if (code === 0) {
            loading1.succeed("代码提交成功!");
            resolve();
          } else {
            loading1.fail("代码提交失败");
            reject("代码提交失败");
          }
        });
      });
    });
  });
}

// 连接服务器
function connectSSH() {
  const loading = ora({
    text: "正在连接服务器...",
    spinner: spinner_style.grenade,
  }).start();
  return new Promise((resolve, reject) => {
    SSH.connect({
      host: config.SERVER_PATH,
      username: config.SSH_USER,
      // privateKey: config.PRIVATE_KEY, //秘钥登录(推荐) 方式一
      password: config.PASSWORD, // 密码登录 方式二
    })
      .then(() => {
        loading.succeed("SSH连接服务器成功!");
        resolve();
      })
      .catch((err) => {
        loading.fail("服务器连接失败！");
        reject(err);
      });
  });
}

function clearAndUpdate() {
  return new Promise((resolve, reject) => {
    // 线上目标文件清空,拉取svn库中的打包文件
    // defaultLog('开始删除服务器旧文件')
    const loading = ora({
      text: "正在处理服务器相关文件中...",
      spinner: spinner_style.grenade,
    }).start();

    // 等待命令执行完毕
    SSH.exec(
      `svn co ${config.SVN_PATH}/${config.FOLDER} ${config.FOLDER_NAME} --username ${config.SVN_USER} --password ${config.SVN_PASSWORD} --no-auth-cache`,
      [],
      {
        cwd: config.PATH,
      }
    )
      .then(() => {
        loading.succeed("服务器相关文件处理成功");
        successLog("部署成功!");
        resolve();
      })
      .catch(() => {
        loading.fail("服务器相关文件处理失败");
        errorLog("部署失败!");
        reject();
      });
  });
}

// ------------发布程序---------------
async function runUploadTask(comment) {
  successLog("开始部署");
  try {
    // 打包
    await compileDist();
    // 将打包后的项目提交到svn
    await submitCodeToSVN(comment);
    // 连接ssh
    await connectSSH();
    // 连接服务器从svn拉取代码
    await clearAndUpdate();
  } catch (err) {
    console.log(err);
  }
  process.exit();
}

// 执行交互后 启动发布程序
async function deploy() {
  // 用于选择部署正式环境还是测试环境 env为choices中的value
  // const { env } = await inquirer.prompt([{
  //   type: 'list',
  //   message: '请选择发布环境',
  //   name: 'env',
  //   choices: [{
  //     name: '测试环境',
  //     value: 'development'
  //   }]
  // }])

  rootPath = await findRootPath();
  CONFIG = require(path.resolve(__dirname, rootPath) + "/deployConfig.js"); // 配置
  const { comment } = await inquirer.prompt([
    {
      type: "input",
      message: "请输入svn代码提交注释: ",
      name: "comment",
      default: "fixbug",
    },
  ]);
  config = CONFIG["development"];
  checkConfig(config); // 检查
  runUploadTask(comment); // 发布
}

module.exports = deploy;
