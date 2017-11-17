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
    }
    destructor() {
    }

    getNiceName() {
        return "Autoproj Workspace";
    }

    isEligible() {
        return (this.workspacePath != null) && (this.packagePath === this.workspacePath)
    }

    settings() {
        return autoproj.loadWorkspaceInfo(this.workspacePath).
            then((workspaceInfo) => {
                return autoproj.rootTargets(workspaceInfo);
            })
    }
}
