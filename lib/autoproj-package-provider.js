'use babel';
'use strict';
const yaml = require('js-yaml');
const fs   = require('fs');
const path = require('path');
const autoproj = require('./autoproj-package')
import voucher from 'voucher';

exports.AutoprojPackageProvider = class AutoprojPackageProvider {
    constructor(packagePath) {
        this.packagePath = packagePath;
        this.workspacePath = autoproj.findWorkspaceRoot(packagePath)
        if (!this.workspacePath) {
            return;
        }

        this.workspaceName = path.basename(this.workspacePath)
        this.autoprojExePath = path.join(this.workspacePath, '.autoproj', 'bin', 'autoproj');
        this.installationManifestPath =
            path.join(this.workspacePath, '.autoproj', 'installation-manifest');
    }
    destructor() {
        return 'void';
    }

    getNiceName() {
        return "Autoproj Package";
    }

    isEligible() {
        return fs.existsSync(this.installationManifestPath);
    }

    settings() {
        const that = this;

        return voucher(fs.readFile, this.installationManifestPath).
            then((data) => {
                const manifest = yaml.safeLoad(data);
                var currentPackage = that.findCurrentPackage(manifest)
                packages = []
                if (currentPackage && currentPackage.name) {
                    packages = packages.concat(autoproj.packageTargets(currentPackage, that.workspacePath));
                }
                packages = packages.concat(autoproj.rootTargets(that.workspacePath))
                return packages;
            })
    }

    findCurrentPackage(manifest) {
        var packagePath = this.packagePath
        if (this.packagePath) {
            return manifest.find((entry) => {
                return packagePath === entry.srcdir || packagePath.startsWith(entry.srcdir + path.sep)
            })
        }
    }
}
