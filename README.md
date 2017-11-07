# Atom package to support autoproj workspaces as a build plugin

This package adds support to interact with the [Autoproj workspace
manager](https://github.com/rock-core/autoproj) as a build plugin in Atom.

## Installation

~~~
apm install build-autoproj
~~~

## Usage

Add the root of an autoproj workspace as a project with File > Add Project
Folder. From there on, in any view that opens a file within this workspace,
the target list (bound to F7 by default) will list the package as targets.
It allows to `build`, `build --force` and `update` each package. The targets
are named `${workspace_name}:build:${package_name}`,
`${workspace_name}:force-build:${package_name}` and
`${workspace_name}:update:${package_name}`. To build/force-build/update the whole
workspace, use the `:all` targets

It supports having multiple workspaces open at the same time (I don't recommend
this, though, as for instance the quick-open file box will show duplicates)

