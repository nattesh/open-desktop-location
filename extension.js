import GLib from 'gi://GLib';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

function findDesktopFile(app) {
    if (!app) return null;

    const appInfo = app.get_app_info();
    if (appInfo) {
        const filename = appInfo.get_filename();
        if (filename && GLib.file_test(filename, GLib.FileTest.EXISTS))
            return filename;
    }

    const appId = app.get_id();
    if (!appId) return null;

    const dataDirs = [GLib.get_user_data_dir(), ...GLib.get_system_data_dirs()];
    for (const dir of dataDirs) {
        const path = GLib.build_filenamev([dir, 'applications', appId]);
        if (GLib.file_test(path, GLib.FileTest.EXISTS))
            return path;
    }

    return null;
}

function openNautilusAtPath(filePath) {
    const flags = GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD;
    try {
        GLib.spawn_async(null, ['nautilus', '--select', filePath], null, flags, null);
    } catch (_e) {
        const dir = GLib.path_get_dirname(filePath);
        try {
            GLib.spawn_async(null, ['nautilus', dir], null, flags, null);
        } catch (e2) {
            console.error(`[OpenDesktopLocation] Error opening Nautilus: ${e2}`);
        }
    } finally {
        Main.overview.hide();
    }
}

function injectMenuEntry(appIcon) {
    const menu = appIcon._menu;
    if (!menu) return;
    if (appIcon._openDesktopLocationInjected) return;
    appIcon._openDesktopLocationInjected = true;

    const app = appIcon.app;
    if (!app) return;

    const desktopFile = findDesktopFile(app);
    if (!desktopFile) return;

    menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

    const item = new PopupMenu.PopupMenuItem(_('go-to-desktop'), {});
    item.connect('activate', () => openNautilusAtPath(desktopFile));
    menu.addMenuItem(item);
}

let _origPopupMenu = null;

function _patchAppIcon() {
    _origPopupMenu = AppDisplay.AppIcon.prototype.popupMenu;

    AppDisplay.AppIcon.prototype.popupMenu = function (...args) {
        const result = _origPopupMenu.apply(this, args);

        if (this._menu && !this._openDesktopLocationInjected)
            injectMenuEntry(this);

        return result;
    };
}

function _unpatchAppIcon() {
    if (_origPopupMenu !== null) {
        AppDisplay.AppIcon.prototype.popupMenu = _origPopupMenu;
        _origPopupMenu = null;
    }
}

export default class OpenDesktopLocationExtension extends Extension {
    enable() {
        _patchAppIcon();
    }

    disable() {
        _unpatchAppIcon();
    }
}
