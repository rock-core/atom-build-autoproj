'use babel';
'use strict';
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
const autoproj = require('./autoproj-package')
import voucher from 'voucher';

export default {
    /**
     * Install atom-build if it's not already
     */
    activate() {
        require('atom-package-deps').install('build-autoproj');
    },

    /**
     * @return {AutoprojBuildProvider}
     */
    providingFunction() {
        return class AutoprojBuildProvider {
            constructor(workspace_path) {
                this.workspace_path = workspace_path;
                this.autoproj_exe_path = path.join(this.workspace_path, '.autoproj', 'bin', 'autoproj');
                this.installation_manifest_path =
                    path.join(this.workspace_path, '.autoproj', 'installation-manifest');
            }
            destructor() {
                return 'void';
            }

            getNiceName() {
                return "Autoproj Workspace";
            }

            isEligible() {
                return fs.existsSync(this.installation_manifest_path);
            }

            settings() {
                const that = this;
                all_packages = []
                return voucher(fs.readFile, this.installation_manifest_path).
                    then((data) => {
                        const manifest = yaml.safeLoad(data);
                        var currentPackage = that.findCurrentPackage(manifest)
                        if (currentPackage && currentPackage.name) {
                            all_packages = all_packages.concat(that.packageTargets(currentPackage));
                        }
                        all_packages = all_packages.concat(that.rootTargets())
                        return manifest.
                            filter((entry) => entry.name).
                            reduce((result, entry) => {
                                if (!currentPackage || entry.name == currentPackage.name) {
                                    return result;
                                }
                                else {
                                    return result.concat(that.packageTargets(entry))
                                }
                            }, all_packages)
                    })
            }

            findCurrentPackage(manifest) {
                const currentEditor = atom.workspace.getActiveTextEditor();
                if (!currentEditor) {
                    return;
                }

                var currentPath = currentEditor.getPath();
                if (currentPath) {
                    return manifest.find((entry) => currentPath.startsWith(entry.srcdir + path.sep))
                }
            }

            packageTargets(pkg, workspace_path) {
                return [
                    new autoproj.BuildPackage(pkg.name, pkg.type, this.workspace_path),
                    new autoproj.ForceBuildPackage(pkg.name, pkg.type, this.workspace_path),
                    new autoproj.UpdatePackage(pkg.name, pkg.type, this.workspace_path),
                    new autoproj.TestPackage(pkg.name, pkg.type, this.workspace_path)
                ]
            }

            rootTargets(workspace_path) {
                return [
                    new autoproj.Build(this.workspace_path),
                    new autoproj.ForceBuild(this.workspace_path),
                    new autoproj.Update(this.workspace_path),
                    new autoproj.UpdateConfig(this.workspace_path)
                ]
            }
        }
    }
}
