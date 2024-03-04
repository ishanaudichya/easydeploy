const express = require("express");
const httpProxy = require("http-proxy");

const app = express();
const PORT = 8000;

const BASE_PATH = "https://netlify-clone.s3.ap-south-1.amazonaws.com/__outputs"; // Replace with your S3 bucket URL

const proxy = httpProxy.createProxy();

app.use((req, res) => {
  const host = req.hostname;
  const subdomain = host.split(".")[0];
  const resolvesTo = `${BASE_PATH}/${subdomain}`;

  return proxy.web(req, res, { target: resolvesTo, changeOrigin: true });
});

proxy.on("proxyReq", (proxyReq, req, res) => {
  const url = req.url;
  if (url === "/") proxyReq.path += "index.html";
});

app.listen(PORT, () => console.log(`Proxy Running at ${PORT}`));
