import sys
import os
import time
import json
import cv2
import numpy as np

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

# Ensure Backend is in python path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

if __name__ == '__main__':
    print("=" * 70)
    print("SPORTGUARD AI — ARCHIVIST INGESTION & PERFORMANCE BENCHMARK")
    print("=" * 70)

    # Import archivist module
    t_import_start = time.perf_counter()
    from agents.archivist import (
        tool_ingest_video,
        _load_clip,
        _clip,
        _processor,
        _embed_batch,
        vector_db,
        metadata_store,
        temporal_store,
        INGEST_SAMPLE_SEC,
    )
    t_import_end = time.perf_counter()
    print(f"[Import] Archivist imported in {t_import_end - t_import_start:.3f}s")
    print(f"[Config] Current INGEST_SAMPLE_SEC: {INGEST_SAMPLE_SEC}s")

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 1: Corrupt File Handling
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 1: Corrupt / Non-video file error handling ---")
    corrupt_file = os.path.join(backend_dir, "corrupt_test.mp4")
    t0 = time.perf_counter()
    res_corrupt = tool_ingest_video(corrupt_file)
    t1 = time.perf_counter()
    print(f"Result on corrupt file (<10KB): {res_corrupt}")
    assert "[ERROR]" in res_corrupt

    corrupt_large = os.path.join(backend_dir, "corrupt_large.mp4")
    t0 = time.perf_counter()
    res_corrupt_lg = tool_ingest_video(corrupt_large)
    t1 = time.perf_counter()
    print(f"Result on corrupt file (56KB invalid mp4): {res_corrupt_lg}")
    assert "[ERROR]" in res_corrupt_lg
    print("[PASS] Corrupt file tests passed: fail gracefully with informative error.")

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 2: Short 7-second Video Ingestion (< 30 seconds)
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 2: Short 7-second video ingestion (< 30 seconds) ---")
    test_7s = os.path.join(backend_dir, "test_7s_scenes.mp4")

    # Inspect video properties
    cap = cv2.VideoCapture(test_7s)
    fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_frames / fps
    cap.release()
    print(f"Video stats: duration={duration:.2f}s, fps={fps}, total_frames={total_frames}")

    t0 = time.perf_counter()
    res_7s = tool_ingest_video(test_7s)
    t1 = time.perf_counter()
    print(f"Result on 7s video: {res_7s}")
    print(f"Total time taken: {t1 - t0:.3f}s")
    assert "[SUCCESS]" in res_7s, f"Expected [SUCCESS], got {res_7s}"
    assert "Scenes=" in res_7s, "Expected scene counts in result"
    print("[PASS] Short video test passed: successfully extracted and indexed frames.")

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 3: Pipeline Timing Breakdown on Real Video (pp.mp4 or sample)
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 3: Detailed Pipeline Profiling on a real sample clip ---")
    real_video = "C:/Users/ravip/Downloads/pp.mp4"
    if not os.path.exists(real_video):
        real_video = test_7s

    cap = cv2.VideoCapture(real_video)
    real_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    real_total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    real_dur = real_total_frames / real_fps
    cap.release()
    print(f"Profiling video: {real_video}")
    print(f"Video stats: duration={real_dur:.2f}s, frames={real_total_frames}, fps={real_fps}")

    # Benchmark Model Load
    t_model_0 = time.perf_counter()
    _load_clip()
    t_model_1 = time.perf_counter()
    model_load_time = t_model_1 - t_model_0
    print(f"Model load time (cached check): {model_load_time:.4f}s")

    # Run full ingest and profile
    t_run_0 = time.perf_counter()
    res_real = tool_ingest_video(real_video)
    t_run_1 = time.perf_counter()
    print(f"Ingest Result: {res_real}")
    print(f"Total Ingest Elapsed: {t_run_1 - t_run_0:.3f}s")

    # ─────────────────────────────────────────────────────────────────────────────
    # TEST 4: Model Reuse Check (Does model reload for second request?)
    # ─────────────────────────────────────────────────────────────────────────────
    print("\n--- TEST 4: Model Reload Check ---")
    t_second_0 = time.perf_counter()
    res_second = tool_ingest_video(test_7s)
    t_second_1 = time.perf_counter()
    print(f"Second Ingest Elapsed: {t_second_1 - t_second_0:.3f}s")
    print(f"Model reused: {t_second_1 - t_second_0 <= (t_run_1 - t_run_0 + 1.0)}")

    print("\n" + "=" * 70)
    print("BENCHMARK COMPLETED SUCCESSFULLY")
    print("=" * 70)
