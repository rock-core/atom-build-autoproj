'use babel';
'use strict';

Helpers = require('./helpers.js');
import { AutoprojWorkspaceProvider } from '../lib/autoproj-workspace-provider.js';

describe("AutoprojWorkspaceProvider", function () {
    let workspaceRoot;

    beforeEach(function () {
        Helpers.init();
        workspaceRoot = Helpers.mkdir('test')
    })
    afterEach(function () {
        Helpers.clear();
    })

    it('declares itself eligible for the workspace root', function () {
        Helpers.mkdir('test', '.autoproj')
        Helpers.createInstallationManifest([], 'test');
        let provider = new AutoprojWorkspaceProvider(workspaceRoot);
        expect(provider.isEligible()).toBe(true);
    })
    it('does not declare itself eligible outside an autoproj workspace', function () {
        let provider = new AutoprojWorkspaceProvider(workspaceRoot);
        expect(provider.workspaceRoot).toBe(undefined);
        expect(provider.isEligible()).toBe(false);
    })
    it('does not declare itself eligible for a package within the workspace', function () {
        Helpers.mkdir('test', '.autoproj')
        Helpers.createInstallationManifest([], 'test');
        let provider = new AutoprojWorkspaceProvider(Path.join(workspaceRoot, 'pkg'));
        expect(provider.isEligible()).toBe(false);
    })

    describe("settings", function () {
        it("returns the workspace targets", function () {
            Helpers.mkdir('test', '.autoproj')
            Helpers.createInstallationManifest([], 'test')
            let provider = new AutoprojWorkspaceProvider(workspaceRoot);
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
