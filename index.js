'use strict';

var url = require('url');
var path = require('path');
var httpProxy = require('http-proxy');
var proxy = httpProxy.createProxyServer({});

function requireUncached(module){
  delete require.cache[require.resolve(module)];
  return require(module);
}

function dispatcher(req, res, next) {
  return function (rule) {
    if (rule.from.test(req.path)) {
      if (rule.to.indexOf('require!') === 0) {
        // 使用本地文件模拟数据
        var urlObject = url.parse(req.url);
        var filepath = urlObject.pathname
          .replace(rule.from, rule.to)
          .replace('require!', '');
        var realpath = path.join(process.cwd(), filepath);
        res.setHeader('Content-Type', 'application/json');
        requireUncached(realpath)(req, res);
      } else if (rule.to.indexOf('http://') === 0) {
        // 使用跨域API模拟数据
        var toUrl = req.url.replace(rule.from, rule.to);
        var targetUrl = url.parse(toUrl);
        req.url = toUrl;
        proxy.web(req, res, {
          target: targetUrl.protocol + '//' + targetUrl.host,
          changeOrigin: true
        }, function (e) {
          // 连接服务器错误
          res.writeHead(502, { 'Content-Type': 'text/html' });
          res.end(e.toString());
        });
      } else {
        // 使用同域名的其他API模拟数据
        var toUrl = req.url.replace(req.path, rule.to);
        req.url = toUrl;
        next();
      }
      return true;
    }
  };
};

function rewrite(rewriteTable) {
  var rules = [];
  Object.keys(rewriteTable).forEach(function(from) {
    var to = rewriteTable[from];
    rules.push({
      from: new RegExp(from),
      to: to
    });
  });
  return function(req, res, next) {
    if (rules.length === 0 || !rules.some(dispatcher(req, res, next))) {
      next();
    }
  };
}

module.exports = rewrite;
