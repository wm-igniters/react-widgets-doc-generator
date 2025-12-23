/**
 * Fetches documentation content from the WaveMaker docs GitHub repository
 */

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/wavemaker/docs/master/learn/app-development/widgets';

/**
 * Mapping of component names to their documentation paths in the WaveMaker docs repo
 * This is needed because the folder structure is not consistent
 */
export const DOC_PATH_MAPPING: Record<string, string> = {
    // Container widgets
    'accordion': 'container/accordion.md',
    'tabs': 'container/tabs.md',
    'panel': 'container/panel.md',
    'tile': 'container/tile.md',
    'wizard': 'container/wizard.md',
    'layoutgrid': 'container/grid-layout.md',

    // Form widgets
    'button': 'form-widgets/button.md',
    'button-group': 'form-widgets/button-group.md',
    'checkbox': 'form-widgets/checkbox.md',
    'checkboxset': 'form-widgets/checkboxset.md',
    'chips': 'form-widgets/chips.md',
    'currency': 'form-widgets/currency.md',
    'date': 'form-widgets/date-time-datetime.md',
    'datetime': 'form-widgets/date-time-datetime.md',
    'time': 'form-widgets/date-time-datetime.md',
    'fileupload': 'form-widgets/file-upload.md',
    'number': 'form-widgets/number.md',
    'radioset': 'form-widgets/radioset.md',
    'rating': 'form-widgets/rating-widget.md',
    'select': 'form-widgets/select.md',
    'selectlocale': 'form-widgets/select-locale.md',
    'slider': 'form-widgets/slider.md',
    'switch': 'form-widgets/switch.md',
    'text': 'form-widgets/text.md',
    'textarea': 'form-widgets/textarea.md',
    'toggle': 'form-widgets/toggle.md',
    'calendar': 'form-widgets/calendar.md',

    // Basic widgets
    'anchor': 'basic/anchor.md',
    'audio': 'basic/audio.md',
    'icon': 'basic/icon.md',
    'label': 'basic/label.md',
    'lottie': 'basic/lottie.md',
    'message': 'basic/message.md',
    'picture': 'basic/picture.md',
    'progress-bar': 'basic/progress-bar.md',
    'progress-circle': 'basic/progress-circle.md',
    'search': 'basic/search.md',
    'spinner': 'basic/spinner.md',
    'video': 'basic/video.md',

    // Dialog widgets
    'dialog': 'design-dialog.md',
    'alertdialog': 'alert-dialog.md',
    'confirmdialog': 'confirm-dialog.md',
};

/**
 * Fetch documentation content from GitHub for a given component
 * @param componentName - The component name (e.g., 'accordion', 'button')
 * @returns The markdown content or null if not found
 */
export async function fetchDocContent(componentName: string): Promise<string | null> {
    const docPath = DOC_PATH_MAPPING[componentName.toLowerCase()];

    if (!docPath) {
        console.log(`ℹ No documentation mapping found for: ${componentName}`);
        return null;
    }

    const url = `${GITHUB_RAW_BASE}/${docPath}`;

    try {
        console.log(`📥 Fetching existing docs for ${componentName} from GitHub...`);
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`⚠ Failed to fetch docs for ${componentName}: ${response.status}`);
            return null;
        }

        const content = await response.text();
        console.log(`✓ Fetched ${content.length} bytes of existing documentation`);
        return content;
    } catch (error) {
        console.error(`✗ Error fetching docs for ${componentName}:`, error);
        return null;
    }
}
