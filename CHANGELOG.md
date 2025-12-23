# Changelog

## [1.2.0] - 2025-12-10

### Added
- **Multi-provider AI support**: Added OpenAI support alongside Claude
- **Environment configuration**: `.env` file support for AI provider settings
- **AI-powered markdown generation**: Generate comprehensive API reference documentation using LLMs
- **Provider flexibility**: Easily switch between Claude and OpenAI models
- **Cost estimation**: Documented pricing for all supported models

### Changed
- Configuration now uses environment variables via `.env` file
- API keys are now configured per-provider (ANTHROPIC_API_KEY, OPENAI_API_KEY)
- Consolidated all documentation into single `README.md` file
- CLI `--with-docs` flag now generates markdown using configured AI provider

### Documentation
- Created comprehensive single README with all setup and usage information
- Added provider comparison and cost estimation tables
- Added troubleshooting section for common issues
- Removed separate documentation files (ENV-SETUP.md, LLM-DOCS.md, EXCLUSIONS.md)

### Dependencies
- Added `@anthropic-ai/sdk` ^0.32.1
- Added `openai` ^4.73.0
- Added `dotenv` ^16.4.5

## [1.1.0] - 2025-12-08

### Added
- Configuration system for excluding categories and components
- `EXCLUSIONS.md` documentation explaining exclusion strategy

### Changed
- Excluded `page` and `prefab` categories by default (82 → 76 components)
- Improved style class extraction to capture all `addStyle` calls
- Style class names with `DEFAULT_CLASS` references are now resolved to actual class names

### Fixed
- Style extraction now correctly identifies `addStyle` calls as both identifiers and property access
- `DEFAULT_CLASS + '-rtl'` patterns are now resolved to actual class names like `app-anchor-rtl`
- Duplicate style classes are now filtered out

### Examples

**Before:**
```json
{
  "styles": [
    {"className": "app-anchor", "description": "Default style class"}
  ]
}
```

**After:**
```json
{
  "styles": [
    {"className": "app-anchor", "description": "Default style class"},
    {"className": "app-anchor-rtl"},
    {"className": "link-primary"},
    {"className": "link-secondary"},
    {"className": "link-success"},
    {"className": "link-danger"},
    {"className": "link-warning"},
    {"className": "link-info"},
    {"className": "link-light"},
    {"className": "link-dark"}
  ]
}
```

## [1.0.0] - 2025-12-08

### Initial Release

- Extract TypeScript source from JavaScript source maps
- Parse component props including inheritance (BaseProps, BaseInputProps)
- Extract public methods with parameters and return types
- Identify event handlers (props starting with 'on')
- Extract style classes from style definitions
- Generate structured JSON documentation
- CLI with commands: `generate`, `list`
- Support for 76 components across 9 categories
