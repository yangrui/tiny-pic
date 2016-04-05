#! /usr/bin/env node

// Copyright (c) 2016 Yang Rui

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const tinify = require('tinify');
const program = require('commander');

const pjson = require('./package.json');

const kConfigFileName = '.tinypic.json';

const kVersion = pjson.version;

function readConfig(dir) {
  let result;
  const filePath = path.join(dir, kConfigFileName);
  try {
    const text = fs.readFileSync(filePath, {
      encoding: 'utf8',
    });
    result = text && JSON.parse(text);
  } catch (err) {
    // do nothing
  }
  return Object.assign({
    _file: filePath,
    tinied: [],
    version: kVersion,
  }, result);
}

function writeConfig(configs) {
  const myConfigs = {
    version: kVersion,
    tinied: configs.tinied.sort(),
  };

  fs.writeFile(configs._file,
    JSON.stringify(myConfigs, '\t'),
    err => (err && console.log(`writeConfig: ${err}`)));
}

function md5Hash(str) {
  return crypto.createHash('md5').update(str).digest('hex');
}

function needTinify(data, configs) {
  return (!configs || configs.tinied.indexOf(md5Hash(data)) < 0);
}

function setTinified(data, configs) {
  if (data && configs) {
    const md5 = md5Hash(data);
    if (configs.tinied.indexOf(md5) < 0) {
      configs.tinied.push(md5);
      writeConfig(configs);
    }
  }
}

function tinyFile(file, configs) {
  const suffix = '.png';
  if (file && file.length > suffix.length &&
    suffix === file.slice(-suffix.length)) {
    fs.readFile(file, (err, sourceData) => {
      if (err) {
        console.warn(`readFile: Fail ${err}`);
      } else if (needTinify(sourceData, configs)) {
        tinify.fromBuffer(sourceData).toBuffer((err2, resultData) => {
          if (err2) {
            console.warn(`toBuffer: Fail ${err2}`);
          } else {
            setTinified(resultData, configs);
            fs.writeFile(file, resultData, err3 => {
              if (err3) {
                console.warn(`writeFile: Fail ${err3}`);
              } else {
                console.log(`Tiny: count=${tinify.compressionCount} ${file}`);
              }
            });
          }
        });
      } else {
        console.log(`Skip: ${file}`);
      }
    });
  }
}

function tinyDir(dir, configs) {
  fs.readdir(dir, (err, names) => {
    if (err) {
      console.warn(err);
    } else {
      const myConfigs = configs || readConfig(dir);
      names.forEach(name => tinyAll(path.join(dir, name), myConfigs));
    }
  });
}

function tinyAll(file, configs) {
  fs.stat(file, (err, stats) => {
    if (err) {
      console.warn(err);
    } else if (stats.isFile()) {
      tinyFile(file, configs);
    } else if (stats.isDirectory()) {
      tinyDir(file, configs);
    } else {
      // Ignore
    }
  });
}

program.version(kVersion)
  .usage('[options] <file ...>')
  .option('-k, --key [value]', 'Your API key')
  .parse(process.argv);

if (program.key) {
  tinify.key = program.key;
  if (program.args && program.args.length > 0) {
    program.args.forEach((file) => tinyAll(file));
  } else {
    tinyDir('.');
  }
} else {
  program.outputHelp();
}
