'use babel';
'use strict';

import {AutoprojPackageProvider} from './autoproj-package-provider'
import {AutoprojWorkspaceProvider} from './autoproj-workspace-provider'

export default {
    /**
     * Install atom-build if it's not already
     */
    activate() {
        require('atom-package-deps').install('build-autoproj');
    },

    deactivate() {
    },

    provideBuild() {
        return [AutoprojPackageProvider, AutoprojWorkspaceProvider];
    }
}
