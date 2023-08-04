const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const cognito = new AWS.CognitoIdentityServiceProvider();

const prefix_parameter = '/SFTP/';
const transferAccessRole = process.env.TransferAccessRole;
const UserPool = process.env.UserPool;

exports.lambdaHandler = async (event, context) => {
    console.log("event", JSON.stringify(event))
    let auth_response = {};
    let response = {};

    if (event.password !== '') {
        // Logic for password-based authentication
        console.log(`Password Authentication for ${event.username}`);

        try {
        const secret = await getSecret(`${prefix_parameter}${event.username}`);
        if (secret) {
            console.log("secret",secret, typeof secret)
            const secretDict = JSON.parse(secret);
            response.HomeDirectory = secretDict.HomeDirectory
        auth_response = await cognito.initiateAuth({
            ClientId: secretDict.userpoolclientid,
            AuthFlow: 'USER_PASSWORD_AUTH',
            AuthParameters: { USERNAME: event.username, PASSWORD: event.password }
        }).promise();
        console.log("auth_response",auth_response)
        if (auth_response.ChallengeName === 'NEW_PASSWORD_REQUIRED') {
        var params = {
                Password: event.password, /* required */
                UserPoolId: UserPool,
                Username: event.username, 
                Permanent: true 
            };
            await cognito.adminSetUserPassword(params).promise();
        }
        }else {
            console.log('Secrets Manager exception thrown - Returning empty response');
            return {};
        }
        } catch (error) {
            console.log(`User Not Found Exception: ${event.username} ${error}`);
            throw error;
        }
        response.Role = transferAccessRole;
    } else {
        // For Password-less authentication
        if (event.protocol === 'SFTP') {
        // Public key-based authentication
        console.log(`SFTP Authentication for ${event.username}`);
        response.Role = transferAccessRole;
        
        } else {
        console.log('Password field cannot be empty');
        return {};
        }
    }
    console.log("response", response)
    return response;
};
async function getSecret(id) {
    const region = process.env.SecretsManagerRegion;
    console.log('Secrets Manager Region: ' + region);
    console.log('Secret Name: ' + id);
  
    // Create a Secrets Manager client
    const client = new AWS.SecretsManager({ region });
  
    try {
      const resp = await client.getSecretValue({ SecretId: id }).promise();
      // Decrypts secret using the associated KMS CMK.
      // Depending on whether the secret is a string or binary, one of these fields will be populated.
      if (resp.SecretString) {
        console.log('Found Secret String');
        return resp.SecretString;
      } else {
        console.log('Found Binary Secret');
        return resp.SecretBinary;
      }
    } catch (err) {
      console.log('Error Talking to SecretsManager: ' + err + ', Message: ' + err.Message);
      return null;
    }
  }