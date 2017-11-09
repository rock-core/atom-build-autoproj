'use babel';
'use strict';
const fs            = require('fs');
const path          = require('path');
const autoproj      = require('./autoproj-package')
const child_process = require('child_process')
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
                    envsh = child_process.spawn(that.autoprojExePath, ['envsh'], {cwd: that.workspacePath, stdio: 'ignore'})
                    envsh.on('close', (code) => {
                        that.emit('refresh');
                        if (code != 0) {
                            atom.notifications.addError(`Autoproj: Failed to update workspace information for ${this.workspacePath}`)
                        }
                    })
                })
            )
        }
    }
    destructor() {
        this.subscriptions.dispose();
        return 'void';
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
