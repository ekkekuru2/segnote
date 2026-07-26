// 現在のパイプラインのバージョン。
//
// ステージ構成や各ステージで使うモデルを変えたら、このバージョンを上げる。
// アップロード時に Recording.targetPipelineVersion へ焼き込まれ、どの録音を
// どのバージョンで処理すべきか/したかを追跡できるようにする。
//
// !!! src/worker 側の worker/pipeline.py の CURRENT_PIPELINE_VERSION と揃えること !!!
export const CURRENT_PIPELINE_VERSION = "v1";
