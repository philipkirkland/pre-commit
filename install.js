'use strict';

//
// Compatibility with older node.js as path.exists got moved to `fs`.
//
var fs = require('fs')
  , path = require('path')
  , os = require('os')
  , hook = path.join(__dirname, 'hook')
  , root = path.resolve(__dirname, '..', '..')
  , exists = fs.existsSync || path.existsSync;

//
// Gather the location of the possible hidden .git directory, the hooks
// directory which contains all git hooks and the absolute location of the
// `pre-commit` file. The path needs to be absolute in order for the symlinking
// to work correctly.
//

var git = getGitFolderPath(root);

// Function to recursively finding .git folder
function getGitFolderPath(currentPath) {
  var git = path.resolve(currentPath, '.git')

  if (!exists(git) || !fs.lstatSync(git).isDirectory()) {
    console.log('pre-commit:');
    console.log('pre-commit: Not found .git folder in', git);
    
    var newPath = path.resolve(currentPath, '..');

    // Stop if we on top folder
    if (currentPath === newPath) {
      return null;
    }

    return getGitFolderPath(newPath);
  }

  console.log('pre-commit:');
  console.log('pre-commit: Found .git folder in', git);
  return git;
}

//
// Resolve git directory for submodules
//
if (exists(git) && fs.lstatSync(git).isFile()) {
  var gitinfo = fs.readFileSync(git).toString()
    , gitdirmatch = /gitdir: (.+)/.exec(gitinfo)
    , gitdir = gitdirmatch.length == 2 ? gitdirmatch[1] : null;

  if (gitdir !== null) {
    git = path.resolve(root, gitdir);
    hooks = path.resolve(git, 'hooks');
    precommit = path.resolve(hooks, 'pre-commit');
  }
}

//
// Bail out if we don't have an `.git` directory as the hooks will not get
// triggered. If we do have directory create a hooks folder if it doesn't exist.
//
if (!git) {
  console.log('pre-commit:');
  console.log('pre-commit: Not found any .git folder for installing pre-commit hook');
  return;
}

var hooks = path.resolve(git, 'hooks')
  , precommit = path.resolve(hooks, 'pre-commit');

if (!exists(hooks)) fs.mkdirSync(hooks);

//
// If there's an existing `pre-commit` hook we want to back it up instead of
// overriding it and losing it completely as it might contain something
// important.
//
if (exists(precommit) && !fs.lstatSync(precommit).isSymbolicLink()) {
  console.log('pre-commit:');
  console.log('pre-commit: Detected an existing git pre-commit hook');
  fs.writeFileSync(precommit +'.old', fs.readFileSync(precommit));
  console.log('pre-commit: Old pre-commit hook backuped to pre-commit.old');
  console.log('pre-commit:');
}

//
// We cannot create a symlink over an existing file so make sure it's gone and
// finish the installation process.
//
try { fs.unlinkSync(precommit); }
catch (e) {}

// Create generic precommit hook that launches this modules hook (as well
// as stashing - unstashing the unstaged changes)
// TODO: we could keep launching the old pre-commit scripts
var hookRelativeUnixPath = hook.replace(root, '.');

if(os.platform() === 'win32') {
  hookRelativeUnixPath = hookRelativeUnixPath.replace(/[\\\/]+/g, '/');
}

var precommitContent = '#!/usr/bin/env bash' + os.EOL
  +  hookRelativeUnixPath + os.EOL
  + 'RESULT=$?' + os.EOL
  + '[ $RESULT -ne 0 ] && exit 1' + os.EOL
  + 'exit 0' + os.EOL;

//
// It could be that we do not have rights to this folder which could cause the
// installation of this module to completely fail. We should just output the
// error instead destroying the whole npm install process.
//
try { fs.writeFileSync(precommit, precommitContent); }
catch (e) {
  console.error('pre-commit:');
  console.error('pre-commit: Failed to create the hook file in your .git/hooks folder because:');
  console.error('pre-commit: '+ e.message);
  console.error('pre-commit: The hook was not installed.');
  console.error('pre-commit:');
}

try { fs.chmodSync(precommit, '775'); }
catch (e) {
  console.error('pre-commit:');
  console.error('pre-commit: chmod 0775 the pre-commit file in your .git/hooks folder because:');
  console.error('pre-commit: '+ e.message);
  console.error('pre-commit:');
}
