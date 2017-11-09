'use babel';
'use strict';
const yaml = require('js-yaml');
const fs            = require('fs');
const path          = require('path');
const autoproj      = require('./autoproj-package')
const child_process = require('child_process')
const PackageList = require('./package-list')
import voucher from 'voucher';
import { EventEmitter } from 'events'
import { CompositeDisposable } from 'atom';

exports.AutoprojWorkspaceProvider = class AutoprojWorkspaceProvider extends EventEmitter {
    constructor(packagePath) {
        super()

        this.packagePath = packagePath;
        this.workspacePath = autoproj.findWorkspaceRoot(packagePath)
        if (!this.workspacePath) {
            return;
        }

        this.workspaceName = path.basename(this.workspacePath)
        this.autoprojExePath = path.join(this.workspacePath, '.autoproj', 'bin', 'autoproj');
        this.installationManifestPath =
            path.join(this.workspacePath, '.autoproj', 'installation-manifest');

        this.subscriptions = new CompositeDisposable()
        if (this.isEligible()) {
            var that = this
            this.subscriptions.add(
                atom.commands.add('atom-workspace', `autoproj:update-workspace-info-of-${this.workspaceName}`, () => {
                    this.updateWorkspaceInfo()
                }),
                atom.commands.add('atom-workspace', `autoproj:add-package-to-project-${this.workspaceName}`, () => {
                    this.addPackageToProject()
                })
            )
        }
    }
    destructor() {
        this.subscriptions.dispose();
        return 'void';
    }

    addPackageToProject() {
        this.packageList = new PackageList();
        var that = this;
        voucher(fs.readFile, this.installationManifestPath).
            then((manifestData) => {
                const manifest = yaml.safeLoad(manifestData);
                const packages = manifest.
                    filter((entry) => entry.name)
                const packageNames = packages.
                    map((entry) => entry.name)
                that.packageList.setItems(packageNames)
                that.packageList.awaitSelection().then((selectedPackageName) => {
                    const selectedPackage = packages.find((entry) => entry.name == selectedPackageName)
                    atom.project.addPath(selectedPackage.srcdir)
                });
            }).catch((err) => {
                atom.notifications.addError(err)
            })
    }
    updateWorkspaceInfo() {
        var that = this;
        envsh = child_process.spawn(this.autoprojExePath, ['envsh'], {cwd: this.workspacePath, stdio: 'ignore'})
        envsh.on('close', (code) => {
            that.emit('refresh');
            if (code != 0) {
                atom.notifications.addError(`Autoproj: Failed to update workspace information for ${that.workspacePath}`)
            }
        })
    }

    getNiceName() {
        return "Autoproj Workspace";
    }

    isEligible() {
        return fs.existsSync(this.installationManifestPath) && this.packagePath === this.workspacePath
    }

    settings() {
        return autoproj.rootTargets(this.workspacePath);
    }
}
