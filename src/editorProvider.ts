'use strict';

import { Disposable, Uri, workspace, ExtensionContext, commands, ViewColumn, window } from 'vscode';

import * as Path from 'path';
import * as fs from "fs";

export default class EditorProvider {
    
    private static s_instance?: EditorProvider = null;
    private static s_editorUri?: Uri = null;
    private _disposables: Disposable[] = [];
    private editorPanel = null;

    constructor(
        private context: ExtensionContext
    ) {
        if(EditorProvider.s_instance) {
            EditorProvider.s_instance.dispose();
        }
        EditorProvider.s_instance = this;
        EditorProvider.s_editorUri = Uri.file(context.asAbsolutePath(Path.join('media', 'editor', 'index.html')));
        
        this._disposables.push( commands.registerCommand("3dviewer.openEditor", () => {
            this.editorPanel = window.createWebviewPanel(
                "threeJsEditor",
                "THREE.js Editor",
                ViewColumn.Active,
                {
                    localResourceRoots: [Uri.file(Path.join(context.extensionPath, "media"))],
                    enableScripts: true
                }
            );
            var file = fs.readFileSync(context.asAbsolutePath(Path.join("media", "editor", "index.html")));
            var html = file.toString();
            html = html.replace(/(src|href)="([^"]*)"/g, (_, a, b) => {
                var path = this.editorPanel.webview.asWebviewUri(Uri.file(context.asAbsolutePath(Path.join("media", "editor", b))));
                return `${a}="${path}"`;
            });
            this.editorPanel.webview.html = html;
            this.patchEditor();
        }) );

        this._disposables.push( commands.registerCommand("3dviewer.openInEditor", (fileUri: Uri) => {
            this.editorPanel = window.createWebviewPanel(
                "threeJsEditor",
                "THREE.js Editor",
                ViewColumn.Active,
                {
                    localResourceRoots: [Uri.file(Path.join(context.extensionPath, "media"))],
                    enableScripts: true
                }
            );
            var file = fs.readFileSync(context.asAbsolutePath(Path.join("media", "editor", "index.html")));
            var html = file.toString();
            html = html.replace(/(src|href)="([^"]*)"/g, (_, a, b) => {
                var path = this.editorPanel.webview.asWebviewUri(Uri.file(context.asAbsolutePath(Path.join("media", "editor", b))));
                return `${a}="${path}"`;
            });
            this.editorPanel.webview.html = html;
            this.patchEditor();
            this.importFile(fileUri);
        }) );

        this._disposables.push( commands.registerCommand("3dviewer.openUrlInEditor", () => {
            window.showInputBox({prompt: "Enter URL to open", placeHolder: "http://..."}).then((value) => {
                if (value) {
                    let fileUri = Uri.parse(value);
                    this.importFile(fileUri);
                }
            });
        }) );

        this._disposables.push( commands.registerCommand("3dviewer.onMessage", EditorProvider.onMessage) );
        this._disposables.push( commands.registerCommand("3dviewer.displayString", EditorProvider.displayString) );
        this._disposables.push( commands.registerCommand("3dviewer.sendCommand", this.sendCommand) );
        this._disposables.push( commands.registerCommand("3dviewer.importFile", this.importFile) );

    }

    static get instance() {
        return EditorProvider.s_instance;
    }

    sendCommand(command: string): Thenable<boolean> {
        if (EditorProvider.s_editorUri) {
            return this.editorPanel.postMessage({ eval: command });
        }
        return Promise.resolve(false);
    }

    importFile(uri: Uri): Thenable<boolean> {
        return this.sendCommand(`
            if (!window.fileLoader) {
                window.fileLoader = new THREE.FileLoader();
                window.fileLoader.crossOrigin = '';
                window.fileLoader.setResponseType( 'arraybuffer' );
            }
            window.fileLoader.load('${uri.toString()}', (data) => { 
                editor.loader.loadFile( new File([data], '${Path.basename(uri.fsPath)}'), '${Path.dirname(uri.toString())}/' ) 
            });
        `);
    }

    public dispose(): void {
        this._disposables.forEach(d => d.dispose());
    }

    // Inject script file on client in order to patch the editor functionalities
    private patchEditor() {
        this.sendCommand(`document.body.appendChild(document.createElement("script")).src="${this.editorPanel.webview.asWebviewUri(Uri.file(this.context.asAbsolutePath(Path.join('media', 'editorPatch.js'))))}"`);
    }

    private static onMessage(e) {
        console.log(e);
    }

    private static displayString(text) {
        workspace.openTextDocument({language: 'json', content: text}).then((doc) => {
            window.showTextDocument(doc, ViewColumn.Three, true);
        });
    }
}
