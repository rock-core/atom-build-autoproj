'use babel';
'use strict';

Helpers = require('./helpers.js');
import { AutoprojPackageProvider } from '../lib/autoproj-package-provider.js';

describe("AutoprojPackageProvider", function () {
    let workspaceRoot;

    beforeEach(function () {
        Helpers.init();
        workspaceRoot = Helpers.mkdir('test')
    })
    afterEach(function () {
        Helpers.clear();
    })

    it('does not declare itself eligible for the workspace root', function () {
        Helpers.mkdir('test', '.autoproj')
        Helpers.createInstallationManifest([], 'test');
        let provider = new AutoprojPackageProvider(workspaceRoot);
        expect(provider.isEligible()).toBe(false);
    })
    it('does not declare itself eligible for a package outside an autoproj workspace', function () {
        let provider = new AutoprojPackageProvider(workspaceRoot);
        expect(provider.workspaceRoot).toBe(undefined);
        expect(provider.isEligible()).toBe(false);
    })
    it('does declare itself eligible for a package within a workspace', function () {
        Helpers.mkdir('test', '.autoproj')
        Helpers.createInstallationManifest([], 'test');
        let provider = new AutoprojPackageProvider(Path.join(workspaceRoot, 'pkg'));
        expect(provider.isEligible()).toBe(true);
    })

    describe("findCurrentPackage", function () {
        it("returns the package whose srcdir is the package dir", function () {
            let pkg_dir = Path.join(workspaceRoot, 'pkg')
            let provider = new AutoprojPackageProvider(pkg_dir);
            let pkg = {srcdir: pkg_dir}
            let workspaceInfo = { packages: new Map([['test', pkg]]) }
            expect(provider.findCurrentPackage(workspaceInfo)).toBe(pkg)
        })
        it("returns the package whose srcdir a parent of the package dir", function () {
            let pkg_dir = Path.join(workspaceRoot, 'pkg')
            let provider = new AutoprojPackageProvider(Path.join(pkg_dir, 'subdir'));
            let pkg = {srcdir: pkg_dir}
            let workspaceInfo = { packages: new Map([['test', pkg]]) }
            expect(provider.findCurrentPackage(workspaceInfo)).toBe(pkg)
        })
        it("returns null if the package path is not part of a registered package", function () {
            let pkg_dir = Path.join(workspaceRoot, 'pkg')
            let provider = new AutoprojPackageProvider(pkg_dir);
            let pkg = {srcdir: Path.join(workspaceRoot, 'something_else')}
            let workspaceInfo = { packages: new Map([['test', pkg]]) }
            expect(provider.findCurrentPackage(workspaceInfo)).toBe(null)
        })
    })

    describe("settings", function () {
        it("returns package and workspace targets if the path is part of a registered package", function () {
            Helpers.mkdir('test', '.autoproj')
            Helpers.createInstallationManifest([{ name: 'test', srcdir: Path.join(workspaceRoot, 'pkg') }], 'test')
            let pkg_dir = Path.join(workspaceRoot, 'pkg')
            let provider = new AutoprojPackageProvider(pkg_dir);
            let targets;
            promise = provider.settings().then((result) => {
                targets = result;
            })
            waitsForPromise(() => promise)
            runs(() => {
                let expected = [
                    "Autoproj Build: test",
                    "Autoproj Build: test (nodeps)",
                    "Autoproj Force Build: test",
                    "Autoproj Force Build: test (nodeps)",
                    "Autoproj Update: test",
                    "Autoproj Update: test (nodeps)",
                    "Autoproj Checkout: test",
                    "Autoproj Test: test (nodeps)",
                    "Autoproj Build: all",
                    "Autoproj Force Build: all",
                    "Autoproj Update: all",
                    "Autoproj Checkout: all",
                    "Autoproj Update Config: all",
                    "Autoproj Test: all"]
                let targetNames = targets.map((t) => t.name);
                expect(targetNames).toEqual(expected);
            })
        })
        it("only returns the workspace targets if the path is not part of a registered package", function () {
            Helpers.mkdir('test', '.autoproj')
            Helpers.createInstallationManifest([], 'test')
            let pkg_dir = Path.join(workspaceRoot, 'pkg')
            let provider = new AutoprojPackageProvider(pkg_dir);
            let targets;
            promise = provider.settings().then((result) => {
                targets = result;
            })
            waitsForPromise(() => promise)
            runs(() => {
                let expected = [
                    "Autoproj Build: all",
                    "Autoproj Force Build: all",
                    "Autoproj Update: all",
                    "Autoproj Checkout: all",
                    "Autoproj Update Config: all",
                    "Autoproj Test: all"]
                let targetNames = targets.map((t) => t.name);
                expect(targetNames).toEqual(expected);
            })
        })
    })
})
