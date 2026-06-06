import gzip
import urllib.request
import shutil
import xml.etree.ElementTree as ET
import os

source_url = "https://epgshare01.online/epgshare01/epg_ripper_ALL_SOURCES1.xml.gz"
downloaded_file = "master_epg.xml.gz"
output_file = "bd_in_guide.xml.gz"

print("Downloading master EPG file (this may take a minute)...")
req = urllib.request.Request(source_url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
with urllib.request.urlopen(req) as response, open(downloaded_file, 'wb') as out_file:
    shutil.copyfileobj(response, out_file)

valid_channels = set()

print("Pass 1: Finding BD and IN channels...")
with gzip.open(downloaded_file, 'rb') as f:
    for event, elem in ET.iterparse(f, events=('end',)):
        if elem.tag == 'channel':
            channel_id = elem.get('id', '').lower()
            if channel_id.endswith('.bd') or channel_id.endswith('.in') or '.bd.' in channel_id or '.in.' in channel_id:
                valid_channels.add(elem.get('id'))
            elem.clear() # Clear memory for this root element
        elif elem.tag == 'programme':
            elem.clear() # We don't need to save programmes in pass 1

print(f"Found {len(valid_channels)} matching channels. Pass 2: Generating new XML...")

with gzip.open(output_file, 'wt', encoding='utf-8') as out:
    out.write('<?xml version="1.0" encoding="UTF-8"?>\n')
    out.write('<tv generator-info-name="LiveTV_Auto_EPG">\n')
    
    with gzip.open(downloaded_file, 'rb') as f:
        for event, elem in ET.iterparse(f, events=('end',)):
            if elem.tag == 'channel':
                if elem.get('id') in valid_channels:
                    out.write(ET.tostring(elem, encoding='unicode'))
                elem.clear()
            elif elem.tag == 'programme':
                if elem.get('channel') in valid_channels:
                    out.write(ET.tostring(elem, encoding='unicode'))
                elem.clear()
            
    out.write('</tv>\n')

print("Success! Filtered EPG generated as bd_in_guide.xml.gz")
os.remove(downloaded_file)
