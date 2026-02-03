
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream';
import { promisify } from 'util';

const pump = promisify(pipeline);

const ALLOWED_LOGOS = [
    'loginLogo',
    'logo',          // Header logo
    'TopLogo1',
    'mobilelogo',
    'favicon',
    'watermark'
];

export async function POST(req: Request) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;
        const logoType = formData.get('logoType') as string;
        const installPath = formData.get('installPath') as string;

        if (!file) {
            return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
        }

        if (!installPath) {
            return NextResponse.json({ error: 'Installation path is required' }, { status: 400 });
        }

        if (!ALLOWED_LOGOS.includes(logoType)) {
            return NextResponse.json({ error: 'Invalid logo type' }, { status: 400 });
        }

        // 1. Validate Installation Path
        const targetDir = path.join(installPath, 'ui', 'images');
        console.log("DEBUG: Checking target directory:", targetDir);
        if (!fs.existsSync(targetDir)) {
            console.log("DEBUG: Directory does NOT exist");
            return NextResponse.json({ error: `Invalid IdentityIQ path: ${targetDir} directory not found` }, { status: 400 });
        }

        // 2. Determine Filename (keep original extension or force png? IIQ usually likes PNG for these but let's check ext)
        // Usually IIQ files are .png. Let's try to stick to the original file name format if possible, 
        // or just force .png if that's what IIQ expects for these specific keys. 
        // For simplicity and safety, let's assume we replace the file with the same name + .png 
        // or we check the uploaded file extension.
        // Actually, let's preserve the uploaded extension but standard implementation usually expects specific names.
        // Let's assume .png for now as most IIQ logos are png.
        // 2. Determine Filename
        // User Request: Favicon should be .ico, others .png
        let fileName = `${logoType}.png`;
        if (logoType === 'favicon') {
            fileName = 'favicon.ico';
        }

        const targetFilePath = path.join(targetDir, fileName);

        // 3. Backup existing file (User Request: backup folder + timestamp)
        // 3. Backup existing file (User Request: backup folder + timestamp)
        const backupDir = path.join(targetDir, 'backups');
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        if (fs.existsSync(targetFilePath)) {
            const d = new Date();
            const pad = (n: number) => n.toString().padStart(2, '0');
            const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

            const ext = path.extname(fileName);
            const base = path.basename(fileName, ext);
            // Format: imagename_datetime_withseconds.ext
            const backupFilename = `${base}_${timestamp}${ext}`;
            const backupPath = path.join(backupDir, backupFilename);

            fs.copyFileSync(targetFilePath, backupPath);
            console.log(`Backed up ${fileName} to ${backupPath}`);
        }

        // 4. Write new file
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        fs.writeFileSync(targetFilePath, buffer);

        // EXTRA: If favicon, also update application icon (images/icons/sailpoint.ico)
        if (logoType === 'favicon') {
            const appIconPath = path.join(installPath, 'images', 'icons', 'sailpoint.ico');
            const appIconDir = path.dirname(appIconPath);

            // Check if directory exists
            if (fs.existsSync(appIconDir)) {

                // User Request: Create backup folder there also
                const appIconBackupDir = path.join(appIconDir, 'backups');
                if (!fs.existsSync(appIconBackupDir)) {
                    try { fs.mkdirSync(appIconBackupDir, { recursive: true }); } catch (e) { }
                }

                // Backup
                if (fs.existsSync(appIconPath)) {
                    const d = new Date();
                    const pad = (n: number) => n.toString().padStart(2, '0');
                    const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}-${pad(d.getSeconds())}`;

                    // Backup name: sailpoint_ico_YYYY-MM-DD...bak
                    const appIconBackup = path.join(appIconBackupDir, `sailpoint_ico_${timestamp}.bak`);
                    try {
                        fs.copyFileSync(appIconPath, appIconBackup);
                    } catch (e) {
                        console.error("Failed to backup sailpoint.ico", e);
                    }
                }
                // Overwrite
                try {
                    fs.writeFileSync(appIconPath, buffer);
                    console.log(`Updated App Icon at ${appIconPath}`);
                } catch (e) {
                    console.error("Failed to update sailpoint.ico", e);
                }
            }
        }

        return NextResponse.json({ success: true, message: `Successfully updated ${fileName}` });

    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Internal Server Error', details: String(e) }, { status: 500 });
    }
}
