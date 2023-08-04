
const AWS = require('aws-sdk');
const prefix_parameter = '/SFTP/';

exports.lambdaHandler = async (event, context) => {
  console.log("event", JSON.stringify(event))
  const requiredParamList = ['serverId', 'username', 'protocol', 'sourceIp'];
  for (const parameter of requiredParamList) {
    if (!(parameter in event)) {
      console.log(`Incoming ${parameter} missing - Unexpected`);
      return {};
    }
  }
  const inputServerId = event['serverId'];
  const inputUsername = event['username'];
  const inputProtocol = event['protocol'];
  const inputSourceIp = event['sourceIp'];
  const inputPassword = event['password'] || '';

  console.log(`ServerId: ${inputServerId}, Username: ${inputUsername}, Protocol: ${inputProtocol}, SourceIp: ${inputSourceIp}`);
  console.log('Start User Authentication Flow');
  let authenticationType = 'PASSWORD';
  const secret = await getSecret(`${prefix_parameter}${inputUsername}`);
  if (secret) {
    const secretDict = JSON.parse(secret);
    // Run our password checks
    const userAuthenticated = authenticateUser(authenticationType, secretDict, inputPassword, inputProtocol);

    if (userAuthenticated) {
      console.log(`User authenticated, calling buildResponse with: ${authenticationType}`);
      const response = buildResponse(secretDict, authenticationType, inputProtocol);
      console.log("response",response)
      return response
    } else {
      console.log('User failed authentication return empty response');
      return {};
    }
  } else {
    console.log('Secrets Manager exception thrown - Returning empty response');
    return {};
  }
};

function lookup(secretDict, key, inputProtocol) {
  if (secretDict.hasOwnProperty(inputProtocol + key)) {
    console.log(`Found protocol-specified ${key}`);
    return secretDict[inputProtocol + key];
  } else {
    return secretDict[key] || null;
  }
}

function authenticateUser(authType, secretDict, inputPassword, inputProtocol) {
    const password = lookup(secretDict, 'Password', inputProtocol);
    if (!password) {
      console.log('Unable to authenticate user - No field match in Secret for password');
      return false;
    }

    if (inputPassword === password) {
      return true;
    } else {
      console.log('Unable to authenticate user - Incoming password does not match stored');
      return false;
    }
}

function buildResponse(secretDict, authType, inputProtocol) {
  const response_data = {};

  // Check for each key-value pair. These are required, so set to an empty string if missing
  const role = lookup(secretDict, "Role", inputProtocol);
  if (role) {
    response_data["Role"] = role;
  } else {
    console.log("No field match for role - Set empty string in response");
    response_data["Role"] = "";
  }

  // These are optional, so ignore if not present
  const policy = lookup(secretDict, "Policy", inputProtocol);
  if (policy) {
    response_data["Policy"] = policy;
  }

  // External Auth providers support chroot and virtual folder assignments, so we'll check for that
  const home_directory_details = lookup(secretDict, "HomeDirectoryDetails", inputProtocol);
  if (home_directory_details) {
    console.log(
      "HomeDirectoryDetails found - Applying setting for virtual folders - Note: Cannot be used in conjunction with key: HomeDirectory"
    );
    response_data["HomeDirectoryDetails"] = home_directory_details;
    // If we have a virtual folder setup, then we also need to set HomeDirectoryType to "Logical"
    console.log("Setting HomeDirectoryType to LOGICAL");
    response_data["HomeDirectoryType"] = "LOGICAL";
  }

  // Note that HomeDirectory and HomeDirectoryDetails / Logical mode can't be used together, but we're not checking for this
  const home_directory = lookup(secretDict, "HomeDirectory", inputProtocol);
  if (home_directory) {
    console.log(
      "HomeDirectory found - Note: Cannot be used in conjunction with key: HomeDirectoryDetails"
    );
    response_data["HomeDirectory"] = home_directory;
  }
  return response_data;
}


async function getSecret(id) {
  const region = process.env.SecretsManagerRegion;
  console.log('Secrets Manager Region: ' + region);
  console.log('Secret Name: ' + id);
  const client = new AWS.SecretsManager({ region });

  try {
    const resp = await client.getSecretValue({ SecretId: id }).promise();
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
