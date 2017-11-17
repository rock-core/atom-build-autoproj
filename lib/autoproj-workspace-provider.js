'use babel';
'use strict';
const yaml = require('js-yaml');
const fs            = require('fs');
const path          = require('path');
const autoproj      = require('./autoproj-package')
const child_process = require('child_process')
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

        this.subscriptions = new CompositeDisposable()
        if (this.isEligible()) {
            var that = this
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
        return this.workspacePath && (this.packagePath === this.workspacePath)
    }

    settings() {
        return autoproj.loadWorkspaceInfo(this.workspacePath).
            then((workspaceInfo) => {
                return autoproj.rootTargets(workspaceInfo);
            })
    }
}
