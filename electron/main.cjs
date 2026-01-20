const { app, BrowserWindow, ipcMain } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { dialog } = require('electron');
const STORE_PATH = path.join(app.getPath('userData'), 'export-path.json');
const jobs = new Map();

app.setName('노깡 STUDIO'); // ✅ 이 줄 (createWindow보다 위)

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    title: '노깡 STUDIO', // ✅ (선택이지만 추천)
    icon: path.join(__dirname, 'icon.ico'), // ✅ 이 줄
    webPreferences: {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
},

  });

  // Vite dev 서버
 win.loadURL('http://localhost:3000');

 }

ipcMain.handle('export:chooseDir', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);

  let defaultPath = undefined;
  try {
    if (fs.existsSync(STORE_PATH)) {
      const saved = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      if (saved?.lastDir) defaultPath = saved.lastDir;
    }
  } catch {}

  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory'],
    defaultPath,
  });

  if (!result.canceled && result.filePaths?.[0]) {
    try {
      fs.writeFileSync(
        STORE_PATH,
        JSON.stringify({ lastDir: result.filePaths[0] }, null, 2),
        'utf8'
      );
    } catch {}
  }

  return {
    canceled: result.canceled,
    dirPath: result.filePaths?.[0] ?? null,
  };
});



ipcMain.handle('export:begin', async (e, { width, height, fps, totalFrames, title, outputDir }) => {
  const jobId = Date.now().toString();
  const dir = path.join(os.tmpdir(), `noggang_${jobId}`);
  fs.mkdirSync(dir, { recursive: true });

  jobs.set(jobId, {
    dir,
    fps,
    title,
    outputDir,
  });

  return { jobId };
});

ipcMain.handle('export:writeFrame', async (e, { jobId, frameIndex, pngBytes }) => {
  const job = jobs.get(jobId);
  if (!job) throw new Error('job not found');

  const name = String(frameIndex).padStart(6, '0') + '.jpg';
  fs.writeFileSync(path.join(job.dir, name), Buffer.from(pngBytes));
});


ipcMain.handle('export:writeAudioWav', async (e, { jobId, wavBytes }) => {
  const job = jobs.get(jobId);
  if (!job) throw new Error('job not found');

  fs.writeFileSync(path.join(job.dir, 'audio.wav'), Buffer.from(wavBytes));
});

ipcMain.handle('export:finalize', async (e, { jobId }) => {
  const job = jobs.get(jobId);
  if (!job) throw new Error('job not found');

const outPath = path.join(job.outputDir, `${job.title}.mp4`);

  await new Promise((res, rej) => {
    execFile(
  'ffmpeg',
  [
    '-y',
    '-framerate', String(job.fps),
    '-f', 'image2',
    '-start_number', '1',
    '-i', path.join(job.dir, '%06d.jpg'),
    '-i', path.join(job.dir, 'audio.wav'),
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    outPath,
  ],

      (err) => (err ? rej(err) : res())
    );
  });

  jobs.delete(jobId);
  return { outputPath: outPath };
});

ipcMain.handle('export:cancel', async (e, { jobId }) => {
  jobs.delete(jobId);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
