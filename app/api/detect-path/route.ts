
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET() {
    const commonPaths = [
        process.env.CATALINA_HOME,
        'C:\\Program Files\\Apache Software Foundation\\Tomcat 9.0',
        'C:\\Program Files\\Apache Software Foundation\\Tomcat 10.0',
        'C:\\Tomcat 9.0',
        'C:\\Tomcat 10.0',
        '/opt/tomcat',
        '/usr/local/tomcat'
    ];

    for (const basePath of commonPaths) {
        if (!basePath) continue;

        // Check possible webapp locations
        const webappsPath = path.join(basePath, 'webapps', 'identityiq');

        // Validate if this looks like a valid IIQ install
        const validationFile = path.join(webappsPath, 'WEB-INF', 'web.xml');
        const imagesDir = path.join(webappsPath, 'ui', 'images'); // Also check for images dir for robustness

        if (fs.existsSync(validationFile) && fs.existsSync(imagesDir)) {
            return NextResponse.json({
                path: webappsPath,
                found: true
            });
        }
    }

    return NextResponse.json({
        path: null,
        found: false,
        message: "Could not auto-detect IdentityIQ installation. Please enter path manually."
    });
}
