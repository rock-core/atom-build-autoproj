'use babel';
'use strict';

const path = require('path');

class Autoproj {
    constructor(workspace_path) {
        this.workspace_path = workspace_path;
        this.sh = false;
        this.cwd = workspace_path;
        this.errorMatch = []
        this.warningMatch = []
        this.exec = path.join(workspace_path, '.autoproj', 'bin', 'autoproj');
    }
}

export class Build extends Autoproj {
    constructor(workspace_path) {
        super(workspace_path)
        this.name = path.basename(workspace_path) + ":build:all"
        this.args = ['build', '--tool'];
    }
}

export class BuildPackage extends Build {
    constructor(package_name, workspace_path) {
        super(workspace_path)
        this.name += ":" + package_name
        this.args.push(package_name)
    }
}

export class ForceBuild extends Autoproj {
    constructor(workspace_path) {
        super( workspace_path)
        this.name = path.basename(workspace_path) + ":force-build:all"
        this.args = ['--tool', '--force', '--deps=f']
    }
}

export class ForceBuildPackage extends ForceBuild {
    constructor(package_name, workspace_path) {
        super(workspace_path)
        this.name += ":" + package_name
        this.args.push(package_name)
    }
}

export class Update extends Autoproj {
    constructor(workspace_path) {
        super(workspace_path)
        this.name = path.basename(workspace_path) + ":update"
        this.args = ['update', '--progress=f'];
    }
}

export class UpdateConfig extends Autoproj {
    constructor(workspace_path) {
        super(workspace_path)
        this.name = path.basename(workspace_path) + ":update-config"
        this.args = ['update', '--config', '--progress=f'];
    }
}

export class UpdatePackage extends Update {
    constructor(package_name, workspace_path) {
        super(workspace_path)
        this.name += ":" + package_name
        this.args.push(package_name)
    }
}
