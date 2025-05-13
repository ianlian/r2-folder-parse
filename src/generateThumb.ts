import { Env } from './index';
import sharp from 'sharp';

export async function handleGenerateThumb(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  try {
    const url = new URL(request.url);
    const folder = url.searchParams.get('folder');
    
    if (!folder) {
      return new Response('Missing folder parameter', { status: 400 });
    }

    // 创建缩略图文件夹
    const thumbFolder = `${folder}_thumb`;
    
    // 列出原始文件夹中的所有对象
    const objects = await env.MY_BUCKET.list({
      prefix: `${folder}/`,
      delimiter: '/'
    });

    // 处理每个对象生成缩略图
    const thumbnails = [];
    for (const object of objects.objects) {
      const fileKey = object.key;
      const fileName = fileKey.split('/').pop() || '';
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';
      const thumbKey = `${thumbFolder}/${fileName.replace(/\.[^/.]+$/, '.jpg')}`;
      
      // 检查缩略图是否已存在
      const existingThumb = await env.MY_BUCKET.get(thumbKey);
      if (existingThumb) {
        thumbnails.push({
          original: fileKey,
          thumbnail: thumbKey,
          type: 'existing'
        });
        continue;
      }

      const originalFile = await env.MY_BUCKET.get(fileKey);
      
      if (originalFile) {
        const fileBuffer = await originalFile.arrayBuffer();
        
        // 处理图片文件
        if (['jpg', 'jpeg', 'png', 'gif'].includes(fileExtension)) {
          try {
            // 使用Sharp生成缩略图
            const thumbnailBuffer = await sharp(Buffer.from(fileBuffer))
              .resize(300, 300, { fit: 'inside' })
              .jpeg({ quality: 80 })
              .toBuffer();
            
            await env.MY_BUCKET.put(thumbKey, thumbnailBuffer);
            thumbnails.push({
              original: fileKey,
              thumbnail: thumbKey,
              type: 'image'
            });
          } catch (error) {
            console.error(`图片缩略图生成失败: ${fileKey}`, error);
          }
        }
        // 处理视频文件
        //else if (['mp4', 'm4v', 'mov'].includes(fileExtension)) {
          //try {
            // 这里需要实现FFmpeg视频缩略图生成逻辑
            // 实际应用中需要调用FFmpeg生成视频缩略图
            // 示例中暂时使用原始文件作为占位符
            //await env.MY_BUCKET.put(thumbKey, fileBuffer);
            //thumbnails.push({
              //original: fileKey,
              //thumbnail: thumbKey,
              //type: 'video'
            //});
          //} catch (error) {
            //console.error(`视频缩略图生成失败: ${fileKey}`, error);
          //}
        //}
      }
    }

    return new Response(JSON.stringify({
      success: true,
      thumbnails: thumbnails,
      thumbFolder: thumbFolder
    }), {
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('处理生成缩略图请求时出错:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}