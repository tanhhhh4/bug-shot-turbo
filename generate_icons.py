#!/usr/bin/env python3
"""
生成Chrome扩展所需的不同尺寸图标
需要安装：pip install pillow cairosvg
"""

import os
from PIL import Image, ImageDraw, ImageFont

def create_icon(size):
    """创建指定尺寸的图标"""
    # 创建带渐变背景的图像
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    
    # 绘制圆形背景（简化的渐变效果）
    center = size // 2
    radius = int(size * 0.45)
    
    # 用紫色作为主色调
    for i in range(radius, 0, -1):
        alpha = int(255 * (1 - i / radius * 0.3))
        color = (102 + i, 126 - i//2, 234, alpha)
        draw.ellipse(
            [center - i, center - i, center + i, center + i],
            fill=color
        )
    
    # 绘制相机图标（简化版）
    camera_width = int(size * 0.5)
    camera_height = int(size * 0.35)
    camera_x = center - camera_width // 2
    camera_y = center - camera_height // 2
    
    # 相机主体
    draw.rounded_rectangle(
        [camera_x, camera_y, camera_x + camera_width, camera_y + camera_height],
        radius=size//16,
        fill=(255, 255, 255, 230)
    )
    
    # 镜头
    lens_radius = int(size * 0.12)
    draw.ellipse(
        [center - lens_radius, center - lens_radius, 
         center + lens_radius, center + lens_radius],
        fill=(255, 107, 107, 255)
    )
    
    # 内圈
    inner_radius = int(size * 0.08)
    draw.ellipse(
        [center - inner_radius, center - inner_radius,
         center + inner_radius, center + inner_radius],
        fill=(255, 255, 255, 200)
    )
    
    # 中心点
    dot_radius = int(size * 0.04)
    draw.ellipse(
        [center - dot_radius, center - dot_radius,
         center + dot_radius, center + dot_radius],
        fill=(255, 82, 82, 255)
    )
    
    # Bug标记（感叹号）
    if size >= 48:  # 只在大图标上显示
        mark_x = center + int(size * 0.18)
        mark_y = center + int(size * 0.18)
        mark_radius = int(size * 0.1)
        
        # 红色圆圈背景
        draw.ellipse(
            [mark_x - mark_radius, mark_y - mark_radius,
             mark_x + mark_radius, mark_y + mark_radius],
            fill=(255, 107, 107, 255)
        )
        
        # 感叹号
        try:
            # 尝试使用系统字体
            font_size = int(size * 0.12)
            font = ImageFont.truetype("arial.ttf", font_size)
        except:
            # 使用默认字体
            font = ImageFont.load_default()
        
        draw.text((mark_x, mark_y), "!", fill=(255, 255, 255, 255), 
                  font=font, anchor="mm")
    
    return img

def main():
    # 创建图标目录
    icon_dir = "assets/icons"
    os.makedirs(icon_dir, exist_ok=True)
    
    # 生成不同尺寸的图标
    sizes = [16, 48, 128]
    
    for size in sizes:
        icon = create_icon(size)
        icon.save(os.path.join(icon_dir, f"icon{size}.png"))
        print(f"Generated icon{size}.png")
    
    print("All icons generated successfully!")

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"Note: For better icons, you may need to install Pillow: pip install pillow")
        print(f"Error: {e}")
        
        # 创建简单的占位图标文件
        print("\nCreating placeholder icons...")
        sizes = [16, 48, 128]
        for size in sizes:
            # 创建简单的纯色图标作为占位符
            from PIL import Image, ImageDraw
            img = Image.new('RGBA', (size, size), (102, 126, 234, 255))
            draw = ImageDraw.Draw(img)
            # 添加白色圆圈
            margin = size // 8
            draw.ellipse([margin, margin, size-margin, size-margin], 
                        fill=(255, 255, 255, 200))
            img.save(f"assets/icons/icon{size}.png")
            print(f"Created placeholder icon{size}.png")