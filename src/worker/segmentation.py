"""ステージ1: inaSpeechSegmenter による区間分割。

音声/動画全体を speech(発話) / music(演奏) / それ以外(noise, noEnergy) に分ける。
inaSpeechSegmenter は内部で ffmpeg を使うため、動画ファイルを渡しても音声を抽出して処理する。
"""

from __future__ import annotations

from typing import Any

# inaSpeechSegmenter が返すラベル -> Segment.type(schema.prisma の SegType)。
# noise / noEnergy などはここでは Segment に落とさない(必要になったら拡張)。
_LABEL_TO_TYPE = {
    "speech": "SPEECH",
    "music": "MUSIC",
}

PROCESSOR_NAME = "inaSpeechSegmenter"


def segment(audio_path: str) -> list[dict[str, Any]]:
    """音声/動画ファイルを区間分割し、[{type, start, end}, ...] を返す。

    type は 'SPEECH' | 'MUSIC'。start/end は秒。
    """
    # tensorflow を伴う重い import なので、呼ばれたときだけ読み込む。
    from inaSpeechSegmenter import Segmenter

    # 'smn': speech / music / noise にラベル付け。detect_gender=False で高速側。
    segmenter = Segmenter(vad_engine="smn", detect_gender=False, batch_size=32)
    raw = segmenter(audio_path)  # [('label', start, end), ...]

    segments: list[dict[str, Any]] = []
    for label, start, end in raw:
        seg_type = _LABEL_TO_TYPE.get(label)
        if seg_type is None:
            continue
        segments.append({"type": seg_type, "start": float(start), "end": float(end)})
    return segments
