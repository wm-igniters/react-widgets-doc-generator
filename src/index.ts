#!/usr/bin/env node

/**
 * CLI entry point for documentation generator
 */

import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { DocumentationGenerator } from './doc-generator.js';
import { LLMDocGenerator } from './llm-doc-generator.js';
import { DEFAULT_CONFIG, getApiKey } from './config.js';

const program = new Command();

program
  .name('wm-doc-generator')
  .description('Generate documentation for WaveMaker React Native components')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate documentation for all components or a specific component')
  .option('-a, --all', 'Generate docs for all components')
  .option('-c, --component <name>', 'Generate docs for a specific component')
  .option('-o, --output <path>', 'Output directory', './output')
  .option('-s, --source <path>', 'Path to components source directory', DEFAULT_CONFIG.componentsSourcePath)
  .option('--single-file', 'Generate a single JSON file with all components')
  .option('--with-docs', 'Generate markdown documentation using LLM (requires ANTHROPIC_API_KEY)')
  .action(async (options) => {
    console.log(`Library path: ${options}`);
    const componentsPath = path.resolve(process.cwd(), options.source);
    const outputPath = path.resolve(process.cwd(), options.output);

    console.log('WaveMaker Component Documentation Generator');
    console.log('==========================================\n');
    console.log(`Components source path1: ${componentsPath}`);
    console.log(`Output path11: ${outputPath}\n`);

    // Check if components path exists
    if (!fs.existsSync(componentsPath)) {
      console.error(`Error: Components source path not found: ${componentsPath}`);
      console.error('Please ensure the components source directory exists');
      console.error(`You can set it via COMPONENTS_SOURCE_PATH in .env or use --source flag`);
      process.exit(1);
    }

    const generator = new DocumentationGenerator(componentsPath);

    // Initialize LLM generator if --with-docs flag is present
    let llmGenerator: LLMDocGenerator | null = null;
    if (options.withDocs) {
      const provider = DEFAULT_CONFIG.llm.provider;
      const apiKey = getApiKey(provider);

      if (!apiKey) {
        console.error(`\nError: API key not set for provider '${provider}'`);
        console.error(`Please set ${provider === 'claude' ? 'ANTHROPIC_API_KEY' : 'OPENAI_API_KEY'} in .env file`);
        console.error('Or copy .env.example to .env and add your API key\n');
        process.exit(1);
      }

      llmGenerator = new LLMDocGenerator(DEFAULT_CONFIG.llm, apiKey);
      console.log(`✓ LLM documentation generation enabled`);
      console.log(`  Provider: ${provider}`);
      console.log(`  Model: ${DEFAULT_CONFIG.llm.model}\n`);
    }

    if (options.all) {
      console.log('Generating documentation for all components...\n');
      const docs = generator.generateAllDocs();

      if (options.singleFile) {
        const outputFile = path.join(outputPath, 'all-components.json');
        generator.saveDocsToFile(docs, outputFile);
      } else {
        // Save individual files
        for (const doc of docs) {
          generator.saveComponentDoc(doc, outputPath);
        }
      }

      console.log(`\n✓ Generated JSON for ${docs.length} components`);

      // Generate LLM docs if requested
      if (llmGenerator) {
        console.log(`\nGenerating markdown documentation with LLM...`);
        let successCount = 0;
        let errorCount = 0;

        // Process in batches to avoid rate limits
        const batchSize = DEFAULT_CONFIG.llm.batchSize;
        const totalBatches = Math.ceil(docs.length / batchSize);

        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = docs.slice(i, i + batchSize);
          const batchNumber = Math.floor(i / batchSize) + 1;

          console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (${batch.length} components)...`);

          // Process batch in parallel
          const results = await Promise.allSettled(
            batch.map(doc => llmGenerator.generateAndSave(doc))
          );

          // Count successes and failures
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') {
              successCount++;
            } else {
              errorCount++;
              const doc = batch[index];
              console.error(`✗ Failed to generate docs for ${doc.componentName}:`, result.reason?.message || result.reason);
            }
          });

          console.log(`  Completed: ${successCount}/${docs.length} components`);
        }

        console.log(`\n✓ Generated markdown for ${successCount} components`);
        if (errorCount > 0) {
          console.log(`✗ Failed: ${errorCount} components`);
        }
      }
    } else if (options.component) {
      console.log(`Generating documentation for ${options.component}...\n`);

      // Find the component
      const components = generator.findAllComponents();
      const component = components.find(c =>
        path.basename(c.path).toLowerCase() === options.component.toLowerCase()
      );

      if (!component) {
        console.error(`Error: Component '${options.component}' not found`);
        console.error('\nAvailable components:');
        components.forEach(c => {
          console.error(`  - ${path.basename(c.path)} (${c.category})`);
        });
        process.exit(1);
      }

      const doc = generator.generateComponentDoc(component.path, component.category);
      if (doc) {
        generator.saveComponentDoc(doc, outputPath);
        console.log('\n✓ JSON documentation generated successfully!');

        // Generate LLM docs if requested
        if (llmGenerator) {
          try {
            console.log('\nGenerating markdown documentation with LLM...');
            await llmGenerator.generateAndSave(doc);
            console.log('✓ Markdown documentation generated successfully!');
          } catch (error) {
            console.error('✗ Failed to generate markdown:', error instanceof Error ? error.message : error);
            process.exit(1);
          }
        }
      } else {
        console.error('Error: Failed to generate documentation');
        process.exit(1);
      }
    } else {
      console.error('Error: Please specify --all or --component <name>');
      program.help();
    }
  });

program
  .command('list')
  .description('List all available components')
  .option('-s, --source <path>', 'Path to components source directory', DEFAULT_CONFIG.componentsSourcePath)
  .action((options) => {
    const componentsPath = path.resolve(process.cwd(), options.source);

    if (!fs.existsSync(componentsPath)) {
      console.error(`Error: Components source path not found: ${componentsPath}`);
      process.exit(1);
    }

    const generator = new DocumentationGenerator(componentsPath);
    const components = generator.findAllComponents();

    console.log(`\nFound ${components.length} components:\n`);

    // Group by category
    const byCategory: Record<string, string[]> = {};
    components.forEach(c => {
      if (!byCategory[c.category]) {
        byCategory[c.category] = [];
      }
      byCategory[c.category].push(path.basename(c.path));
    });

    // Display grouped
    Object.entries(byCategory).forEach(([category, componentNames]) => {
      console.log(`${category}/ (${componentNames.length})`);
      componentNames.forEach(name => {
        console.log(`  - ${name}`);
      });
      console.log('');
    });
  });

// Default command
if (process.argv.length === 2) {
  program.help();
}

program.parse();
