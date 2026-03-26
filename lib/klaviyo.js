const KLAVIYO_BASE_URL = "https://a.klaviyo.com/api";
const KLAVIYO_REVISION = "2026-01-15";

function klaviyoHeaders(apiKey, contentType = "application/vnd.api+json") {
  return {
    Authorization: `Klaviyo-API-Key ${apiKey}`,
    accept: "application/vnd.api+json",
    "content-type": contentType,
    revision: KLAVIYO_REVISION,
  };
}

export async function subscribeSmsProfile({
  apiKey,
  email,
  phoneNumber,
  listId,
}) {
  const attributes = {
    phone_number: phoneNumber,
    subscriptions: {
      sms: {
        marketing: {
          consent: "SUBSCRIBED",
        },
      },
    },
  };

  if (email) {
    attributes.email = email;
  }

  const payload = {
    data: {
      type: "profile-subscription-bulk-create-job",
      attributes: {
        profiles: {
          data: [
            {
              type: "profile",
              attributes,
            },
          ],
        },
      },
    },
  };

  if (listId) {
    payload.data.relationships = {
      list: {
        data: {
          type: "list",
          id: listId,
        },
      },
    };
  }

  const response = await fetch(
    `${KLAVIYO_BASE_URL}/profile-subscription-bulk-create-jobs/`,
    {
      method: "POST",
      headers: klaviyoHeaders(apiKey),
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Klaviyo subscription failed.");
  }
}

export async function sendSmsEvent({
  apiKey,
  phoneNumber,
  email,
  externalId,
  message,
  reminderId,
  frequencyLabel,
  stopCondition,
  manageUrl,
  uploadUrl,
  nextRunAt,
  nextRunAtLabel,
  tone,
}) {
  if (!phoneNumber && !email) {
    throw new Error("Klaviyo event requires a phone number or email.");
  }

  const profileAttributes = {};

  if (phoneNumber) {
    profileAttributes.phone_number = phoneNumber;
  }

  if (email) {
    profileAttributes.email = email;
  }

  if (externalId && (phoneNumber || email)) {
    profileAttributes.external_id = externalId;
  }

  const payload = {
    data: {
      type: "event",
      attributes: {
        properties: {
          message,
          reminder_id: reminderId,
          frequency: frequencyLabel,
          stop_condition: stopCondition,
          manage_url: manageUrl ?? null,
          upload_url: uploadUrl ?? null,
          next_run_at: nextRunAt ?? null,
          next_run_at_label: nextRunAtLabel ?? null,
          tone: tone ?? null,
        },
        metric: {
          data: {
            type: "metric",
            attributes: {
              name: "Reminder Rocket SMS",
            },
          },
        },
        profile: {
          data: {
            type: "profile",
            attributes: profileAttributes,
          },
        },
      },
    },
  };

  const response = await fetch(`${KLAVIYO_BASE_URL}/events/`, {
    method: "POST",
    headers: klaviyoHeaders(apiKey),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Klaviyo SMS event failed.");
  }
}
