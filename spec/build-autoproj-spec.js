'use babel';
'use strict';

const Helpers = require('./helpers.js')
const Autoproj = require('../lib/autoproj-package.js')
const Pkg = require('../lib/build-autoproj.js')
const PackageList = require('../lib/package-list')
import { EventEmitter } from 'events'
const child_process = require('child_process')

describe("the workspace commands", function() {
    let workspaceName;
    let workspaceRoot;
    let workspaceElement;
    var BuildAutoproj;

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
        workspaceElement = atom.views.getView(atom.workspace);
        Helpers.init();
        workspaceName = 'test';
        workspaceRoot = Helpers.mkdir(workspaceName);
        atom.project.setPaths([]);
    })

    afterEach(function() {
        atom.project.setPaths([]);
        Helpers.clear();
    })

    describe("projects existing on activation", function() {
        it("ignores projects that are not autoproj workspaces", function() {
            setProjectPaths([workspaceRoot]);
            activatePackage();
            expectNoCommand();
        })

        it("registers commands for the projects that are autoproj workspaces", function() {
            Helpers.mkdir(workspaceName, '.autoproj')
            Helpers.mkfile('', workspaceName, '.autoproj', 'installation-manifest')
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
            Helpers.mkdir(workspaceName, '.autoproj')
            Helpers.mkfile('', workspaceName, '.autoproj', 'installation-manifest')
            activatePackage();
            setProjectPaths([workspaceRoot]);
            expectCommandsDefined();
        })
    })

    describe("removing projects dynamically", function() {
        it("disposes of the created commands", function() {
            Helpers.mkdir(workspaceName, '.autoproj')
            Helpers.mkfile('', workspaceName, '.autoproj', 'installation-manifest')
            activatePackage();
            setProjectPaths([workspaceRoot]);
            setProjectPaths([]);
            expectNoCommand();
        })
    })

    describe("addPackageToProject", function() {
        it("lists the packages in sorted order and adds the one selected by the user", function() {
            Helpers.mkdir(workspaceName, '.autoproj')
            Helpers.createInstallationManifest([
                { name: 'pkg2', srcdir: '/path/to/pkg2' },
                { name: 'pkg1', srcdir: '/path/to/pkg1' }
            ], workspaceName)
            spyOn(atom.notifications, 'addError')

            activatePackage();

            let packageList = new PackageList();
            let selectionPromise = new Promise((resolve, reject) => { resolve('pkg2') })
            let spy = spyOn(packageList, 'awaitSelection')
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
            activatePackage();
            let eventEmitter = new EventEmitter();
            spyOn(child_process, 'spawn').andReturn(eventEmitter)
            runs(() => {
                BuildAutoproj.updateWorkspaceInfo(workspaceRoot)
                expect(child_process.spawn).
                    toHaveBeenCalledWith(`${workspaceRoot}/.autoproj/bin/autoproj`, ['envsh'], { cwd: workspaceRoot, stdio: 'ignore' })
            })
        })

        it("does not execute two envsh concurrently", function() {
            activatePackage();
            let eventEmitter = new EventEmitter();
            spyOn(child_process, 'spawn').andReturn(eventEmitter)
            spyOn(atom.notifications, 'addError')
            runs(() => {
                BuildAutoproj.updateWorkspaceInfo(workspaceRoot)
                BuildAutoproj.updateWorkspaceInfo(workspaceRoot)
                expect(atom.notifications.addError).toHaveBeenCalledWith('Autoproj: already updating workspace information')
                atom.notifications.addError.reset()
                eventEmitter.emit('close', 0)
                BuildAutoproj.updateWorkspaceInfo(workspaceRoot)
                expect(atom.notifications.addError).not.toHaveBeenCalled()
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
