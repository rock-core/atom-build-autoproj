'use babel';
'use strict';

Autoproj = require('./autoproj-package.js')
Path = require('path')
const PackageList = require('./package-list')
const child_process = require('child_process')
import {CompositeDisposable} from 'atom';
import {AutoprojPackageProvider} from './autoproj-package-provider'
import {AutoprojWorkspaceProvider} from './autoproj-workspace-provider'

export default {
    disposables: new CompositeDisposable(),
    projectPaths: [],
    projectCommands: new Map(),

    /**
     * Install atom-build if it's not already
     */
    activate() {
        require('atom-package-deps').install('build-autoproj');
        this.refreshWorkspaceCommands(atom.project.getPaths())
        this.disposables.add(atom.project.onDidChangePaths((newProjectPaths) => {
            this.refreshWorkspaceCommands(newProjectPaths)
        }))
    },

    deactivate() {
        this.disposables.dispose()
    },

    refreshWorkspaceCommands(newProjectPaths) {
        let addedPaths   = newProjectPaths.filter((el) => {
            return this.projectPaths.indexOf(el) == -1
        })
        let removedPaths = this.projectPaths.filter((el) => {
            return newProjectPaths.indexOf(el) == -1
        })
        this.projectPaths = newProjectPaths;
        removedPaths.forEach((projectPath) => {
            this.projectCommands.get(projectPath).dispose()
            this.projectCommands.delete(projectPath)
        })
        addedPaths.forEach((projectPath) => {
            projectDisposables = new CompositeDisposable()
            this.projectCommands.set(projectPath, projectDisposables)
            this.defineWorkspaceTargets(projectPath, projectDisposables)
        })
    },

    defineWorkspaceTargets(projectPath, disposables) {
        let workspacePath = Autoproj.findWorkspaceRoot(projectPath)
        if (workspacePath !== projectPath) {
            return;
        }
        let workspaceName = Path.basename(workspacePath)

        let that = this;
        disposables.add(
            atom.commands.add('atom-workspace', `autoproj:update-workspace-info-of-${workspaceName}`, () => {
                this.updateWorkspaceInfo(workspacePath)
            }),
            atom.commands.add('atom-workspace', `autoproj:add-package-to-project-${workspaceName}`, () => {
                this.addPackageToProject(workspacePath)
            }),
            atom.menu.add([
                {
                    "label": "Packages",
                    "submenu": [
                        {
                            "label": "Autoproj",
                            "submenu": [
                                {
                                    "label": `${workspaceName}: Update Workspace Info`,
                                    "command": `autoproj:update-workspace-info-of-${workspaceName}`
                                },
                                {
                                    "label": `${workspaceName}: Add Package To Project`,
                                    "command": `autoproj:add-package-to-project-${workspaceName}`
                                }
                            ]
                        }
                    ]
                }
            ])
        )
    },

    addPackageToProject(workspacePath, packageList = new PackageList()) {
        return Autoproj.loadWorkspaceInfo(workspacePath).
            then((workspaceInfo) => {
                const packages = Array.from(workspaceInfo.packages.values())
                const packageNames = packages.
                    map((entry) => entry.name).
                    sort()
                packageList.setItems(packageNames)
                packageList.awaitSelection().then((selectedPackageName) => {
                    const selectedPackage = packages.find((entry) => entry.name == selectedPackageName)
                    atom.project.addPath(selectedPackage.srcdir)
                });
            }).catch((err) => {
                atom.notifications.addError(`Failed to get the list of packages: ${err}`)
            })
    },

    updateWorkspaceInfo(workspacePath) {
        let autoprojExePath = Autoproj.autoprojExePath(workspacePath);
        envsh = child_process.spawn(autoprojExePath, ['envsh'], {cwd: workspacePath, stdio: 'ignore'})
        envsh.on('close', (code) => {
            that.emit('refresh');
            if (code != 0) {
                atom.notifications.addError(`Autoproj: Failed to update workspace information for ${workspacePath}`)
            }
        })
        return envsh
    },

    provideBuild() {
        return [AutoprojPackageProvider, AutoprojWorkspaceProvider];
    }

}
