const EFFECTS = {
    bass: "equalizer=f=54:width_type=o:width=2:g=20",
    nightcore: "asetrate=44100*1.25,aresample=44100",
    tupai: "asetrate=44100*1.5,aresample=44100",
    deep: "asetrate=44100*0.8,aresample=44100",
    slow: "atempo=0.8",
    fast: "atempo=1.2",
    reverse: "areverse",
    robot: "afftfilt=real='hypot(re,im)*sin(0)':imag='hypot(re,im)*cos(0)':win_size=512:overlap=0.75"
};

export default Object.entries(EFFECTS).map(([name, filter]) => ({
    command: [name],
    help: [`${name} (balas audio/video)`],
    tags: ["tools"],
    media: ["audio", "video"],
    limit: 1,
    cooldown: 5,
    loading: true,
    exec: async (m, { conn }) => {
        const buffer = await m.mediaSource.download();
        if (!buffer?.length) throw new UserError("Gagal memuat turun media.");
        const ext = (m.mediaSource.mimetype.split("/")[1] ?? "mp4").split(";")[0];
        const audio = await ffmpeg.runFfmpeg(buffer, { inputExt: ext, outputExt: "mp3", args: ["-vn", "-af", filter, "-ab", "128k"] });
        return conn.sendMessage(m.chat, { audio, mimetype: "audio/mpeg" }, { quoted: m });
    }
}));
