'use babel';
'use strict';

const Autoproj = require('../lib/autoproj-package.js')
const FS = require('fs');
const Temp = require('fs-temp');
const Path = require('path');
const YAML = require('js-yaml')

let root;
let createdFS = []

exports.init = function() {
    root = Temp.mkdirSync();
}
exports.mkdir = function(...path) {
    path = Path.join(root, ...path);
    FS.mkdirSync(path);
    createdFS.push([path, 'dir']);
    return path;
}
exports.mkfile = function(data, ...path) {
    path = Path.join(root, ...path);
    FS.writeFileSync(path, data)
    createdFS.push([path, 'file']);
    return path;
}
exports.createInstallationManifest = function(data, ...workspacePath) {
    workspacePath = Path.join(root, ...workspacePath);
    let path = Autoproj.installationManifestPath(workspacePath);
    FS.writeFileSync(path, YAML.safeDump(data));
    createdFS.push([path, 'file']);
    return path;
}
exports.clear = function() {
    createdFS.reverse().forEach((entry) => {
        if (entry[1] === "file") {
            FS.unlinkSync(entry[0]);
        }
        else if (entry[1] === "dir") {
            FS.rmdirSync(entry[0]);
        }
    })
    createdFS = []
    FS.rmdirSync(root)
    root = null
}
