const AWS = require ('aws-sdk');
const QueryString = require('querystring');
const HTTPS = require ('https');

//Secrets Manager Client Setup
const region = process.env.Region;
const secretsManagerClient = new AWS.SecretsManager({
    region: region
});

var httpsRequest = (options, data) => new Promise((resolve) => {
    const request = HTTPS.request(options, res => {
        var char = '';
        res.on('data', d => {
            char += d
        }).on('end', () => {
            var response = JSON.parse(char.toString());
            response.statusCode = res.statusCode;
            resolve(response)
        })
    });
    request.on('error', error => {
        console.error('error', error)
    });
    if (data) {
        request.write(data)
    };
    request.end()
});

async function getSecret(secretName) {

  /* this will return promise,
  if you add .promise() at the end aws-sdk calls will return a promise
  no need to wrap in custom one
  */
  const response = await secretsManagerClient
                          .getSecretValue({ SecretId: secretName })
                            .promise();

  //what is left is to return the right data
  if ("SecretString" in response) {
    return response.SecretString;
  }

  return Buffer.from(response.SecretBinary, "base64").toString("ascii");
}

exports.lambdaHandler = async(event) => {
    //get environment variables
    const azureSecret = process.env.AzureSecrets;
    const azureDomainSecretKey = process.env.AzureDomainSecretKey;
    const azureClientIdSecretKey = process.env.AzureClientIdSecretKey;
    const s3BucketName = process.env.S3BucketName;
    const TransferRoleARN = process.env.TransferRoleARN;

    //get secrets
    var azureSecrets = JSON.parse(await getSecret(azureSecret));
    azureDomain = azureSecrets[azureDomainSecretKey];
    azureClientId = azureSecrets[azureClientIdSecretKey];
    
    console.log('azureDomain: ', azureDomain);
    console.log('azureClientId: ', azureClientId);
    //get username and add the domain to it
    var user = event.username;
    user = `${user}@${azureDomain}`;

    console.log('user: ', user);
    console.log('azureClientId: ', azureClientId);

    //setup credentials to call Microsoft Graph
    var microsoftGraphCredentials = {
        username: user,
        password: event.password,
        grant_type: 'password',
        scope: 'https://graph.microsoft.com/User.Read',
        response_type: 'token',
        client_id: azureClientId
    };

    var dataToPost = QueryString.stringify(microsoftGraphCredentials);

    //build the post request
    var postRequest = {
        method: 'POST',
        host: 'login.microsoftonline.com',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': dataToPost.length
        },
        path: `/${azureDomain}/oauth2/v2.0/token`,
    };

    var azureToken = await httpsRequest(postRequest, dataToPost);
    //check to see if an access token came back
    if(!azureToken.access_token) {
        //auth failure, log the error
        if(azureToken.error) {
            console.log(
                {
                    status: "Failure",
                    userName: user,
                    errorMessage: azureToken.error,
                    errorURL: azureToken.error_uri
                }
            );
        }
        // exit because auth has failed
        return {}
    } else {
        console.log(
            {
                status: "Success",
                userName: user,
                scope: azureToken.scope
            }
        );
        var response = {
            HomeDirectory: '/' + s3BucketName + '/' + 'home' + '/' + user,
            HomeBucket: s3BucketName,
            Role: TransferRoleARN,
        }

        console.log(response);
        return response;
    }
};
