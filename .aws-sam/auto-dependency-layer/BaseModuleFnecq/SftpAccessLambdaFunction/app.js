const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const openpgp = require('openpgp');
openpgp.config.show_version = false;
openpgp.config.show_comment = false;
async function  encryption(fileBuffer) {
  const fileForOpenpgpjs = new Uint8Array(fileBuffer);
      const encrypt_options = {
        message: await openpgp.createMessage({binary:fileForOpenpgpjs}),
        passwords: ['secret stuff'], 
        format: 'binary'
      };
      const encrypted = await openpgp.encrypt(encrypt_options)
      return encrypted
}
async function  decryption(encrypted) {
  const message = await openpgp.readMessage({binaryMessage: encrypted});
  const decrypt_options = {
    message,
    passwords: ['secret stuff'], 
    format: 'binary'
  };
  const decrypted = await openpgp.decrypt(decrypt_options)
  return decrypted
}
async function  s3PutObject(bucketName,Key, Data) {
  const s3params = {
    Body: Data,
    Bucket: bucketName,
    Key: Key,
};
await s3.putObject(s3params).promise(); 
}
async function  s3GetObject(bucketName,Key) {
  const data=await s3.getObject({
    'Bucket': bucketName,
    'Key': Key,
  }).promise(); 
  return data
}

exports.lambdaHandler = async (event, context) => {
  try {
    // Extract relevant information from the event
    const s3Key = event.Records[0].s3.object.key.replace(/\+/g,' ').replace(/%2B/g, '+');
    const s3bucket = event.Records[0].s3.bucket.name;
    console.log("event",JSON.stringify(event))
    const file_name_array = (s3Key).split("/")
    const file_extension_array = file_name_array[file_name_array.length-1].split(".")
    const file_extension = (file_extension_array[file_extension_array.length-1]).toUpperCase();
    const destinationKey = `${file_extension}/${file_name_array[file_name_array.length-1]}`;
    const uploadKey =`${file_extension}/${file_name_array[file_name_array.length-2]}`
    console.log("destinationKey",destinationKey)
    console.log("uploadKey",uploadKey)
  if(!event.Records[0].s3.object.key.endsWith('.pgp')){// don't try to encrypt files that are already encrypted
    
    const data=await s3GetObject(s3bucket,s3Key)
    const fileBuffer = Buffer.from(data.Body);
    const encrypted = await encryption(fileBuffer)
    await s3PutObject(s3bucket,`${uploadKey}.pgp`,Buffer.from(encrypted))
    const enc_data=await s3GetObject(s3bucket,`${uploadKey}.pgp`)
    const fileData= await decryption(enc_data.Body)
    const exten=(uploadKey.split("/"))[uploadKey.split("/").length-2].toLowerCase()
    const fileName=(uploadKey.split("/"))[uploadKey.split("/").length-1]
    await s3PutObject(s3bucket,`download/${fileName}.${exten}`,Buffer.from(fileData.data))
  }

    return {
      statusCode: 200,
      body: 'File upload handled successfully'
    };
  } catch (error) {
    console.error('Error handling file upload:', error);
    return {
      statusCode: 500,
      body: 'Error handling file upload'
    };
  }
};
