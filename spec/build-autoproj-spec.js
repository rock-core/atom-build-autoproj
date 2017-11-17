'use babel';
'use strict';

const FS = require('fs');
const Temp = require('fs-temp');
const Path = require('path');
const Autoproj = require('../lib/autoproj-package.js')
const YAML = require('js-yaml')
const Pkg = require('../lib/build-autoproj.js')
const PackageList = require('../lib/package-list')
import { EventEmitter } from 'events'
const child_process = require('child_process')

describe("the workspace commands", function() {
    let root;
    let workspaceName;
    let workspaceRoot;
    let createdFS = []
    let workspaceElement;
    var BuildAutoproj;

    const mkdir = function(dir) {
        FS.mkdirSync(dir)
        createdFS.push([dir, 'dir']);
    }
    const mkfile = function(path, data = '') {
        FS.writeFileSync(path, data)
        createdFS.push([path, 'file']);
    }
    const createInstallationManifest = function(workspacePath, data) {
        let path = Autoproj.installationManifestPath(workspacePath)
        FS.writeFileSync(path, YAML.safeDump(data))
        createdFS.push([path, 'file'])
    }

    const activatePackage = function() {
        let promise = atom.packages.activatePackage("build-autoproj").
            then((value) => { BuildAutoproj = value.mainModule })
        waitsForPromise(() => promise);
    }
    const setProjectPaths = function(paths) {
        let pathSettled = jasmine.createSpy();
        runs(() => {
            atom.project.onDidChangePaths(pathSettled)
            atom.project.setPaths(paths)
        })
        waitsFor(() => pathSettled.callCount > 0)
    }
    const expectNoCommand = function() {
        let matched;
        matched = atom.commands.dispatch(workspaceElement, 'autoproj:add-package-to-project-test');
        expect(matched).toBe(false);
        matched = atom.commands.dispatch(workspaceElement, 'autoproj:update-workspace-info-of-test');
        expect(matched).toBe(false);
    }
    const expectCommandsDefined = function() {
        runs(() => {
            spyOn(BuildAutoproj, 'addPackageToProject')
            spyOn(BuildAutoproj, 'updateWorkspaceInfo')
            atom.commands.dispatch(workspaceElement, 'autoproj:add-package-to-project-test')
            atom.commands.dispatch(workspaceElement, 'autoproj:update-workspace-info-of-test')
        })
        waitsFor(() => BuildAutoproj.addPackageToProject.callCount > 0)
        waitsFor(() => BuildAutoproj.updateWorkspaceInfo.callCount > 0)
        runs(() => {
            expect(BuildAutoproj.addPackageToProject).toHaveBeenCalledWith(workspaceRoot)
            expect(BuildAutoproj.updateWorkspaceInfo).toHaveBeenCalledWith(workspaceRoot)
        })
    }
    beforeEach(function() {
        root = Temp.mkdirSync();
        workspaceElement = atom.views.getView(atom.workspace);
        createdFS = []
        workspaceName = 'test';
        workspaceRoot = Path.join(root, workspaceName);
        mkdir(workspaceRoot)
        atom.project.setPaths([])
    })

    afterEach(function() {
        createdFS.reverse().forEach((entry) => {
            if (entry[1] === "file") {
                FS.unlinkSync(entry[0]);
            }
            else if (entry[1] === "dir") {
                FS.rmdirSync(entry[0]);
            }
        })
        atom.project.setPaths([])
        FS.rmdirSync(root)
    })

    describe("projects existing on activation", function() {
        it("ignores projects that are not autoproj workspaces", function() {
            setProjectPaths([workspaceRoot]);
            activatePackage();
            expectNoCommand();
        })

        it("registers commands for the projects that are autoproj workspaces", function() {
            mkdir(Path.join(workspaceRoot, '.autoproj'))
            mkfile(Path.join(workspaceRoot, '.autoproj', 'installation-manifest'))
            setProjectPaths([workspaceRoot]);
            activatePackage();
            expectCommandsDefined();
        })
    })

    describe("adding projects dynamically", function() {
        it("ignores projects that are not autoproj workspaces", function() {
            activatePackage();
            setProjectPaths([workspaceRoot]);
            expectNoCommand();
        })

        it("registers commands for the projects that are autoproj workspaces", function() {
            mkdir(Path.join(workspaceRoot, '.autoproj'))
            mkfile(Path.join(workspaceRoot, '.autoproj', 'installation-manifest'))
            activatePackage();
            setProjectPaths([workspaceRoot]);
            expectCommandsDefined();
        })
    })

    describe("removing projects dynamically", function() {
        it("disposes of the created commands", function() {
            mkdir(Path.join(workspaceRoot, '.autoproj'))
            mkfile(Path.join(workspaceRoot, '.autoproj', 'installation-manifest'))
            activatePackage();
            setProjectPaths([workspaceRoot]);
            setProjectPaths([]);
            expectNoCommand();
        })
    })

    describe("addPackageToProject", function() {
        it("lists the packages in sorted order and adds the one selected by the user", function() {
            mkdir(Path.join(workspaceRoot, '.autoproj'))
            createInstallationManifest(workspaceRoot, [
                { name: 'pkg2', srcdir: '/path/to/pkg2' },
                { name: 'pkg1', srcdir: '/path/to/pkg1' }
            ])
            spyOn(atom.notifications, 'addError')

            activatePackage();

            let packageList = new PackageList();
            let selectionPromise = new Promise((resolve, reject) => { resolve('pkg2') })
            let spy = spyOn(packageList, 'awaitSelection')
            console.log(spy, spy.and)
            spy.andReturn(selectionPromise)
            spyOn(atom.project, 'addPath')
            let addPackagePromise;
            runs(() => {
                addPackagePromise = BuildAutoproj.addPackageToProject(workspaceRoot, packageList)
            })

            waitsFor(() => workspaceElement.querySelector(".package-list li"))
            runs(() => {
                let names = Array.from(workspaceElement.querySelectorAll('.package-list li').entries()).
                    map((li) => li[1].textContent)
                expect(names).toEqual(['pkg1', 'pkg2'])
            })
            waitsForPromise(() => addPackagePromise)
            waitsForPromise(() => selectionPromise)
            runs(() => {
                expect(atom.project.addPath).toHaveBeenCalledWith('/path/to/pkg2')
                expect(atom.notifications.addError).not.toHaveBeenCalled()
            })
        })
    })

    describe("updateWorkspaceInfo", function() {
        it("executes autoproj envsh within the workspace root", function() {
            mkdir(Path.join(workspaceRoot, '.autoproj'))
            activatePackage();
            let eventEmitter = new EventEmitter();
            spyOn(child_process, 'spawn').andReturn(eventEmitter)
            runs(() => {
                BuildAutoproj.updateWorkspaceInfo(workspaceRoot)
                expect(child_process.spawn).
                    toHaveBeenCalledWith(`${workspaceRoot}/.autoproj/bin/autoproj`, ['envsh'], { cwd: workspaceRoot, stdio: 'ignore' })
            })
        })

        describe("busy provider support", function () {
            let busyProvider;
            let eventEmitter;

            beforeEach(function () {
                activatePackage();
                busyProvider = jasmine.createSpyObj('the busy provider', ['add', 'remove']);
                eventEmitter = new EventEmitter();
                spyOn(child_process, 'spawn').andReturn(eventEmitter)
                runs(() => {
                    BuildAutoproj.busyProvider = busyProvider
                })
            })

            afterEach(function () {
                if (BuildAutoproj) {
                    BuildAutoproj.busyProvider = undefined
                }
            })

            it("sets up a busy signal on spawn if provided", function() {
                runs(() => {
                    BuildAutoproj.updateWorkspaceInfo(workspaceRoot);
                    expect(busyProvider.add).toHaveBeenCalledWith(`Autoproj: Update Workspace Info of ${workspaceRoot}`);
                    expect(busyProvider.remove).not.toHaveBeenCalled();
                })
            })

            it("removes the busy signal with success if the subprocess finished successfully", function() {
                runs(() => {
                    BuildAutoproj.updateWorkspaceInfo(workspaceRoot);
                    eventEmitter.emit('close', 0);
                    expect(busyProvider.remove).toHaveBeenCalledWith(`Autoproj: Update Workspace Info of ${workspaceRoot}`, true)
                })
            })

            it("removes the busy signal with failure if the subprocess finished successfully", function() {
                runs(() => {
                    BuildAutoproj.updateWorkspaceInfo(workspaceRoot);
                    eventEmitter.emit('close', 1);
                    expect(busyProvider.remove).toHaveBeenCalledWith(`Autoproj: Update Workspace Info of ${workspaceRoot}`, false)
                })
            })
        })
        
        it("notifies a build error", function() {
            spyOn(atom.notifications, 'addError')
            activatePackage();
            let eventEmitter = new EventEmitter();
            spyOn(child_process, 'spawn').andReturn(eventEmitter)
            runs(() => {
                BuildAutoproj.updateWorkspaceInfo(workspaceRoot)
                eventEmitter.emit('close', 1)
                expect(atom.notifications.addError).toHaveBeenCalledWith(`Autoproj: Failed to update workspace information for ${workspaceRoot}`)
            })
        })
    })
})
