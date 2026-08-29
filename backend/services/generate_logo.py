from PIL import Image, ImageDraw, ImageFont
import os
from pathlib import Path

def generate_solushan_logo(output_path: str):
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    # Create high-resolution logo image
    img = Image.new("RGB", (600, 160), color=(255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Try to load Arial or modern sans font, or default
    try:
        font = ImageFont.truetype("arialbd.ttf", 72)
    except:
        try:
            font = ImageFont.truetype("Arial.ttf", 72)
        except:
            font = ImageFont.load_default()
            
    # Red for S (#A10F2B / deep burgundy-crimson), Black for OLUSHAN (#111111)
    s_color = (161, 15, 43)
    rest_color = (18, 18, 18)
    
    # Draw 'S'
    draw.text((30, 40), "S", font=font, fill=s_color)
    # Draw 'OLUSHAN'
    draw.text((95, 40), "OLUSHAN", font=font, fill=rest_color)
    
    img.save(output_path, "PNG")
    print(f"Logo saved to {output_path}")

if __name__ == "__main__":
    generate_solushan_logo("storage/assets/solushan_logo.png")
