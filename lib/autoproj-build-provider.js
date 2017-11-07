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
        const generateErrorMatch =
            ['(.+\n)?CMake Error at (?<file>[\\/0-9a-zA-Z\\._-]+):(?<line>\\d+)'];
        const generateWarningMatch =
            ['(.+\n)?CMake Error at (?<file>[\\/0-9a-zA-Z\\._-]+):(?<line>\\d+)'];
        const compileErrorMatch = [
            '(.+:\\d+:\\d+:\n)?(?<file>.+):(?<line>\\d+):(?<column>\\d+):\\s+(.*\\s+)?error:\\s+(?<message>.+)',  // GCC/Clang Error,
            '(?<file>[a-zA-Z\\._\\-\\\\/:0-9]+)\\((?<line>\\d+)\\):\\s*error\\s*(C\\d+)?\\s*:(?<message>.*)',  // Visual Studio Error
        ];
        const compileWarningMatch = [
            '(.+:\\d+:\\d+:\n)?(?<file>.+):(?<line>\\d+):(?<column>\\d+):\\s+(.*\\s+)?warning:\\s+(?<message>.+)',  // GCC/Clang warning
            '(?<file>[a-zA-Z\\._\\-\\\\/:0-9]+)\\((?<line>\\d+)\\):\\s*warning\\s*(C\\d+)?\\s*:(?<message>.*)',  // Visual Studio Error
        ];

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
                const manifest_path = this.installation_manifest_path
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
                        return manifest.map(function (entry) {
                            return entry['name'];
                        }).reduce(function (result, package_name) {
                            if (package_name) {
                                result.push(new autoproj.BuildPackage(package_name, workspace_path))
                                result.push(new autoproj.ForceBuildPackage(package_name, workspace_path))
                                result.push(new autoproj.UpdatePackage(package_name, workspace_path))
                            }

                            return result
                        }, all_packages)
                    })
            }
        }
    }
}
