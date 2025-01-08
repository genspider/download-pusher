const qiniu = require('qiniu');
const fs = require('fs');
const path = require('path');

// 配置七牛云
const accessKey = process.env.QINIU_ACCESS_KEY;  // 从环境变量获取 Access Key
const secretKey = process.env.QINIU_SECRET_KEY;  // 从环境变量获取 Secret Key
const bucket = process.env.QINIU_BUCKET;  // 存储空间名称
const prefix = 'ACoder/download/';  // 设置上传文件的前缀

// 初始化鉴权对象
const mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
const config = new qiniu.conf.Config();
const formUploader = new qiniu.form_up.FormUploader(config);
const putExtra = new qiniu.form_up.PutExtra();

// 上传文件
function uploadFile(localFile, key) {
  const options = {
    scope: `${bucket}:${key}`,
  };
  const formUploadToken = qiniu.util.generateAccessToken(mac, options);

  return new Promise((resolve, reject) => {
    formUploader.putFile(formUploadToken, key, localFile, putExtra, (err, body, info) => {
      if (err) {
        reject(err);
      } else if (info.statusCode === 200) {
        resolve(body);
      } else {
        reject(new Error(`Upload failed with status code ${info.statusCode}`));
      }
    });
  });
}

// 从 links.conf 文件中读取链接并下载
function readLinksAndDownload() {
  const links = fs.readFileSync('links.conf', 'utf-8')
    .split('\n')
    .filter((line) => line.trim() && !line.startsWith('#'));  // 跳过注释行和空行

  return Promise.all(links.map((link) => {
    const fileName = path.basename(link);  // 从链接中提取文件名
    const localFile = fileName;  // 下载到当前目录，文件名与链接中的文件名相同
    const key = `${prefix}${fileName}`;  // 设置上传文件的 key，包括前缀

    // 下载文件
    return new Promise((resolve, reject) => {
      const wget = require('child_process').exec(`wget -O ${localFile} ${link}`);
      wget.stdout.on('data', (data) => console.log(data.toString()));
      wget.stderr.on('data', (data) => console.error(data.toString()));
      wget.on('exit', (code) => {
        if (code === 0) {
          resolve(localFile);  // 下载成功，返回本地文件路径
        } else {
          reject(new Error(`Download failed for ${link}`));
        }
      });
    })
    .then((localFile) => {
      // 上传文件
      return uploadFile(localFile, key);
    });
  }));
}

// 执行下载和上传
readLinksAndDownload()
  .then(() => {
    console.log('All downloads and uploads successful');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Download or upload failed:', err);
    process.exit(1);
  });