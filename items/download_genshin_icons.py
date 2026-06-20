import requests
import os
from urllib.parse import unquote
from concurrent.futures import ThreadPoolExecutor, as_completed

# Configuration
API_ENDPOINT = "https://genshin-impact.fandom.com/api.php"
DOWNLOAD_FOLDER = "genshin_icons"
BATCH_SIZE = 50          # progress print interval
URL_BATCH_SIZE = 50      # MediaWiki allows up to 50 titles per imageinfo query
MAX_WORKERS = 16         # concurrent download threads

# Each entry: (category name on the wiki, subfolder, skip-if-contains list, rename function)
def rename_constellation_file(filename):
    """Strip ' Item.png' suffix and convert spaces to underscores"""
    new_name = filename.replace(" Item.png", ".png")
    new_name = new_name.replace(" ", "_")
    return new_name


def rename_face_file(filename):
    """Face icons keep their original name, just sanitized"""
    return filename

CATEGORIES = [
    {
        "category": "Playable_Character_Icons",
        "subfolder": "face_icons",
        "skip_if_contains": ["Aether", "Lumine"],
        "rename": rename_face_file,
    },
    {
        "category": "Character_Item_Icons",
        "subfolder": "constellation_icons",
        "skip_if_contains": ["Aether", "Lumine"],
        "rename": rename_constellation_file,
    },
]

session = requests.Session()


def get_all_files_in_category(category_name):
    """Get all file pages in the category using MediaWiki API"""
    print(f"Fetching list of files in Category:{category_name}...")

    files = []
    continue_token = None

    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{category_name}",
            "cmlimit": 500,
            "format": "json",
            "cmnamespace": 6
        }

        if continue_token:
            params["cmcontinue"] = continue_token

        response = session.get(API_ENDPOINT, params=params)
        response.raise_for_status()
        data = response.json()

        for member in data["query"]["categorymembers"]:
            files.append(member["title"])

        if "continue" in data:
            continue_token = data["continue"]["cmcontinue"]
            print(f"  Found {len(files)} files so far...")
        else:
            break

    print(f"Total files found: {len(files)}")
    return files


def get_image_urls_batch(file_titles):
    """Get image URLs for up to 50 file titles in a single API call"""
    params = {
        "action": "query",
        "titles": "|".join(file_titles),
        "prop": "imageinfo",
        "iiprop": "url",
        "format": "json"
    }

    response = session.get(API_ENDPOINT, params=params)
    response.raise_for_status()
    data = response.json()

    results = {}
    pages = data.get("query", {}).get("pages", {})
    for page_id, page_info in pages.items():
        title = page_info.get("title")
        if "imageinfo" in page_info:
            results[title] = page_info["imageinfo"][0]["url"]
        else:
            results[title] = None

    return results


def resolve_all_image_urls(file_titles):
    """Resolve image URLs for all files using batched requests"""
    print("Resolving image URLs (batched)...")
    url_map = {}

    batches = [file_titles[i:i + URL_BATCH_SIZE] for i in range(0, len(file_titles), URL_BATCH_SIZE)]
    for i, batch in enumerate(batches, 1):
        batch_results = get_image_urls_batch(batch)
        url_map.update(batch_results)
        print(f"  Resolved {min(i * URL_BATCH_SIZE, len(file_titles))}/{len(file_titles)} URLs")

    return url_map


def download_image(url, filename, download_folder):
    """Download and save image"""
    try:
        response = session.get(url, stream=True)
        response.raise_for_status()

        safe_filename = filename.replace(":", "_").replace("/", "_")
        filepath = os.path.join(download_folder, safe_filename)

        with open(filepath, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)

        return True, filename
    except Exception as e:
        return False, f"{filename}: {e}"


def download_category(category_config):
    """Download every file in a single category into its own subfolder,
    applying skip filters and renaming inline so no separate rename step is needed."""
    category_name = category_config["category"]
    subfolder = category_config["subfolder"]
    skip_if_contains = category_config["skip_if_contains"]
    rename_fn = category_config["rename"]

    download_folder = os.path.join(DOWNLOAD_FOLDER, subfolder)
    os.makedirs(download_folder, exist_ok=True)
    print(f"\n=== Category: {category_name} -> {os.path.abspath(download_folder)} ===")

    # Step 1: Get all file titles
    file_titles = get_all_files_in_category(category_name)

    if not file_titles:
        print("No files found in category!")
        return

    # Step 2: Apply skip filter BEFORE resolving URLs, so filtered files are never even queried
    kept_titles = []
    filtered_out = 0
    for file_title in file_titles:
        original_name = file_title.replace("File:", "")
        if any(skip_text in original_name for skip_text in skip_if_contains):
            filtered_out += 1
            continue
        kept_titles.append(file_title)

    if filtered_out:
        print(f"  Filtered out {filtered_out} files matching skip rules {skip_if_contains}")

    if not kept_titles:
        print("No files left after filtering!")
        return

    # Step 3: Resolve image URLs in batches
    url_map = resolve_all_image_urls(kept_titles)

    # Step 4: Build download job list using final renamed filenames, skipping existing files
    jobs = []
    skipped = 0
    for file_title in kept_titles:
        url = url_map.get(file_title)
        original_name = file_title.replace("File:", "")
        final_name = rename_fn(original_name)
        safe_final_name = final_name.replace(":", "_").replace("/", "_")
        dest_path = os.path.join(download_folder, safe_final_name)

        if os.path.exists(dest_path):
            skipped += 1
            continue

        if not url:
            print(f"  Failed to get URL for {file_title}")
            continue

        jobs.append((url, safe_final_name))

    print(f"\nStarting download of {len(jobs)} files ({skipped} already exist, skipping)...")

    # Step 5: Download concurrently, straight to final filename
    downloaded = 0
    failed = 0
    completed = 0

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = [executor.submit(download_image, url, filename, download_folder) for url, filename in jobs]

        for future in as_completed(futures):
            success, info = future.result()
            completed += 1

            if success:
                downloaded += 1
            else:
                failed += 1
                print(f"  Error downloading {info}")

            if completed % BATCH_SIZE == 0 or completed == len(jobs):
                print(f"  Progress: {completed}/{len(jobs)} files processed")

    # Summary
    print(f"\nCategory '{category_name}' complete!")
    print(f"✓ Successfully downloaded: {downloaded}")
    print(f"⏭ Skipped (already existed): {skipped}")
    print(f"🚫 Filtered out: {filtered_out}")
    print(f"✗ Failed: {failed}")


def main():
    """Main execution"""
    print(f"Icons will be saved under: {os.path.abspath(DOWNLOAD_FOLDER)}")

    for category_config in CATEGORIES:
        download_category(category_config)

    print("\nAll categories complete!")


if __name__ == "__main__":
    main()
