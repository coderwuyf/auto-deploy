# auto-deploy
Use Node to automatically deploy the project to the test server

Currently, only the SVN version has been completed

使用nodejs自动部署项目到测试服务器上

目前只完成了SVN的版本


## 注意事项
svn版本使用前提：需要安装svn命令行工具，一般下载的svn并没有默认选中安装命令行工具，需要手动下载
## 安装 install

```
npm i svn-auto-deploy -D
// or
pnpm add svn-auto-deploy -D
```

## 创建配置文件 create config file

根目录下创建配置文件 deployConfig.js

内容如下

```javascript
module.exports = Object.freeze({
  development: {
    // 测试
    SERVER_PATH: "", // ssh地址 服务器地址
    SSH_USER: "", // ssh 用户名
    PASSWORD: "", // 服务器密码
    PATH: "", // 需要上传的服务器目录地址, 项目文件的    ！！！父级文件夹！！！
    FOLDER_NAME: "", // 需要上传的服务器目录地址，项目文件名
    SVN_PATH: "", // svn项目路径
    SVN_USER: "", // svn账号
    SVN_PASSWORD: "", // svn密码
    FOLDER: "", // 打包后的文件
    buildScripts: "", // 项目构建语句，例如npm run build
  },
});
```

然后在 package.json 中的 scripts 中添加下列语句

```json
"scripts": {
  ...
  "deploy": "deploy"
  ...
}
```

## 使用

```
npm run deploy
```

or

```
yarn deploy
```

or

```
pnpm deploy
```
