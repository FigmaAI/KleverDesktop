import base64
import os
from PIL import Image, ImageDraw
from megfile import smart_open
import io


from megfile import smart_open, smart_makedirs, smart_exists, smart_copy

def make_b64_url(image_path, resize_config=None):
    """
    Convert an image file to a base64 URL.
    """
    image_postfix = os.path.splitext(image_path)[-1].lower()
    with smart_open(image_path, "rb") as f:
        image_data = f.read()
    
    # print(resize_config)
    image = Image.open(io.BytesIO(image_data))

    if resize_config and resize_config.get("is_resize", False) == True:
        image = image.resize(size= resize_config['target_image_size'])
    
    image_data = io.BytesIO()
    image = image.convert('RGB')
    image.save(image_data, format="JPEG", quality=85)
    image_postfix = ".jpeg"
    image_data = image_data.getvalue()

    b64_image = base64.b64encode(image_data).decode('utf-8')
    return f"data:image/{image_postfix[1:]};base64,{b64_image}"

def read_from_url(image_url):
    """
    Read an image from a base64 URL and return a PIL Image.
    """
    if image_url.startswith("data:image/"):
        header, b64_data = image_url.split(",", 1)
        image_data = base64.b64decode(b64_data)
        image = Image.open(io.BytesIO(image_data))
        return image
    else:
        with smart_open(image_url, "rb") as f:
            image_data = f.read()
        image = Image.open(io.BytesIO(image_data))
        return image


def draw_points(image_path, image_path_save, points, color=(255, 0, 0, 128), return_image=False):
    if len(points) == 0:
        return image_path
    
    if type(image_path) == str:
        with smart_open(image_path, "rb") as f:
            image = Image.open(f)
            image = image.copy()
        
    else:
        image = image_path

    draw = ImageDraw.Draw(image)

    width, height = image.size

    # color = (255, 0, 0, 128)  # Red, semi-transparent (alpha=128)

    for x, y in points:
        if type(x) == int or x > 1:
            x = float(int(x))/1000.0
            y = float(int(y))/1000.0

        radius = 0.005 * max(width, height)     # radius

    
        absolute_center_x = float(x * width)
        absolute_center_y = float(y * height)

        draw.ellipse(
            (
                absolute_center_x - radius,  # left top x coordinate
                absolute_center_y - radius,  # left top y coordinate
                absolute_center_x + radius,  # right bottom x coordinate
                absolute_center_y + radius   # right bottom y coordinate
            ),
            fill=color
        )

    drawrd_image = image.copy()

    if return_image:
        return drawrd_image

    else:
        with smart_open(image_path_save, "wb") as f:
            image.save(f, "PNG")
        
        return image_path_save

if __name__ == "__main__":
    # Example usage
    image_path = "tmp_screenshot/uuid_4bead247-acca-4272-bd11-ed67d06fd757.png"  # Replace with your image path
    resize_config = {
        "is_resize": True,
        "target_image_size": (800, 600)  # Resize to 800x600 pixels
    }
    
    b64_url = make_b64_url(image_path, resize_config)

    with open("tmp_imageb64.txt", "w") as f:
        f.write(b64_url)
    
    
    # print(b64_url)  # Output the base64 URL