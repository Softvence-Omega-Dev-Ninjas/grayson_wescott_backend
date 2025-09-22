const { chalkStderr: chalk } = require('chalk');
const { emojify: emoji } = require('node-emoji');
const { execSync } = require('node:child_process');
const { default: yoctoSpinner } = require('yocto-spinner');

// Helper function to run shell commands and return the output
function runCommand(command) {
  try {
    console.log(chalk.blue(`\nRunning command: ${command}\n`)); // Log command for debugging
    return execSync(command, { encoding: 'utf-8' });
  } catch (error) {
    console.error(chalk.red(`Error while executing command: ${command}`));
    return error.message;
  }
}

// Get the list of staged files that are added or modified
function getStagedFiles() {
  const result = runCommand('git diff --cached --name-only');
  return result.split('\n').filter((file) => file); // Remove empty lines
}

// Main function that runs checks and fixes on modified files
(async () => {
  const spinner = yoctoSpinner().start(
    '\nRunning CI checks on modified files...\n',
  );

  const stagedFiles = getStagedFiles();

  if (stagedFiles.length === 0) {
    console.log(chalk.yellow(emoji('⚠️') + ' No staged files to check.'));
    spinner.stop();
    return;
  }

  // Filter for JavaScript/TypeScript files or any other file types you'd like to check
  const filesToCheck = stagedFiles.filter(
    (file) =>
      file.endsWith('.js') ||
      file.endsWith('.ts') ||
      file.endsWith('.jsx') ||
      file.endsWith('.tsx'),
  );

  if (filesToCheck.length === 0) {
    console.log(
      chalk.yellow(emoji('⚠️') + ' No JavaScript/TypeScript files staged.'),
    );
    spinner.stop();
    return;
  }

  try {
    // Run lint check only on specific files
    spinner.start('Running lint check...');
    const lintResult = runCommand(`npm run lint -- ${filesToCheck.join(' ')}`);
    spinner.success(chalk.green(emoji('✅') + ' Lint checks passed!'));

    // Run fix command only on specific files if needed
    spinner.start('Applying fixes...');
    const fixResult = runCommand(
      `npm run lint:fix -- ${filesToCheck.join(' ')}`,
    );
    spinner.success(chalk.green(emoji('⚙️') + ' Fixes applied successfully!'));

    // Output results
    console.log(
      chalk.blue(emoji('💻') + ' Lint check output:\n') +
        chalk.gray(lintResult),
    );
    console.log(
      chalk.blue(emoji('🔧') + ' Fix output:\n') + chalk.gray(fixResult),
    );
    console.log(
      chalk.cyan(emoji('🚀') + ' All checks passed and fixes applied!'),
    );
  } catch (error) {
    spinner.error(chalk.red(emoji('❌') + ' An error occurred.'));
    console.error(chalk.red(error));
  }
})();
