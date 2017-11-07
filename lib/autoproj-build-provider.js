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
                const manifest_path  = this.installation_manifest_path
                const workspace_path = this.workspace_path;

                all_packages = [
                    new autoproj.Build( workspace_path),
                    new autoproj.ForceBuild(workspace_path),
                    new autoproj.Update(workspace_path),
                    new autoproj.UpdateConfig(workspace_path)
                ]
                return voucher(fs.readFile, manifest_path).
                    then((data) => {
                        const manifest = yaml.safeLoad(data);
                        return manifest.
                            filter((entry) => entry.name).
                            reduce((result, entry) => {
                                result.push(new autoproj.BuildPackage(entry.name, entry.type, workspace_path))
                                result.push(new autoproj.ForceBuildPackage(entry.name, entry.type, workspace_path))
                                result.push(new autoproj.UpdatePackage(entry.name, entry.type, workspace_path))
                                return result
                            }, all_packages)
                    })
            }
        }
    }
}
