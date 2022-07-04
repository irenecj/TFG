package com.example.saveplanet;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.IntentFilter.MalformedMimeTypeException;
import android.nfc.FormatException;
import android.nfc.NdefMessage;
import android.nfc.NdefRecord;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.nfc.tech.Ndef;
import android.nfc.tech.NdefFormatable;
import android.os.AsyncTask;
import android.os.Bundle;
import android.util.Log;
import android.view.MenuItem;
import android.view.View;
import android.widget.ImageView;
import android.widget.TextView;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.appcompat.app.ActionBar;
import androidx.appcompat.app.AppCompatActivity;

import com.amazonaws.auth.CognitoCachingCredentialsProvider;
import com.amazonaws.mobileconnectors.dynamodbv2.document.Table;
import com.amazonaws.regions.Region;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClient;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.amazonaws.services.dynamodbv2.model.UpdateItemRequest;

import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;

public class MainActivityNFC extends AppCompatActivity {
    public static final String TAG = "NfcDemo";
    public static final String MIME_TEXT_PLAIN = "text/plain";

    private TextView mTextView;
    private ImageView imageView;
    private NfcAdapter mNfcAdapter;

    private final String DYNAMODB_TABLE = "game_data";
    private Context context;
    Table dbTable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main_nfc);

        context = getApplicationContext();
        mTextView = (TextView) findViewById(R.id.textView_explanation);
        imageView = (ImageView) findViewById(R.id.imagen);
        mNfcAdapter = NfcAdapter.getDefaultAdapter(this);

        ActionBar actionBar = getSupportActionBar();
        actionBar.setDisplayHomeAsUpEnabled(true);

        if(mNfcAdapter == null){
            //finalizamos aquí ya que necesitamos NFC
            Toast.makeText(this, "Este dispositivo no soporta NFC.", Toast.LENGTH_LONG).show();
            finish();
            return;
        }

        if(!mNfcAdapter.isEnabled()){
            mTextView.setText("NFC no está habilitado");
        }else{
            mTextView.setText("Elija la carta que desee y acérquela al dispositivo para leerla");
        }

        try {
            handleIntent(getIntent());

        } catch (IOException e) {
            e.printStackTrace();
        } catch (FormatException e) {
            e.printStackTrace();
        }
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item){
        switch(item.getItemId()){
            case android.R.id.home:
                this.finish();
                return true;
        }
        return super.onOptionsItemSelected(item);
    }

    @Override
    protected void onResume() {
        super.onResume();
        setupForegroundDispatch(this, mNfcAdapter);

    }

    @Override
    protected void onPause(){
        stopForegroundDispatch(this, mNfcAdapter);
        super.onPause();
    }

    @Override
    protected void onNewIntent(Intent intent) {

        super.onNewIntent(intent);
        try {
            handleIntent(intent);
        } catch (IOException e) {
            e.printStackTrace();
        } catch (FormatException e) {
            e.printStackTrace();
        }
    }

    private void handleIntent(Intent intent) throws IOException, FormatException {
        String action = intent.getAction();
        String TAG = "SavePlanet";

        if (NfcAdapter.ACTION_NDEF_DISCOVERED.equals(action)) {

            String type = intent.getType();
            if (MIME_TEXT_PLAIN.equals(type)) {

                Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
                new NdefReaderTask().execute(tag);
            } else {
                Log.d(TAG, "Wrong mime type: " + type);
            }
        } else if (NfcAdapter.ACTION_TECH_DISCOVERED.equals(action)) {
            Tag tag = intent.getParcelableExtra(NfcAdapter.EXTRA_TAG);
            String[] techList = tag.getTechList();

            String searchedTech = "android.nfc.tech.Ndef";
            Ndef ndef = Ndef.get(tag);

            if (ndef != null) {
                ndef.connect();
                NdefRecord[] records = {createRecord(tag.getId().toString()) };
                NdefMessage message = new NdefMessage(records);
                ndef.writeNdefMessage(message);
                ndef.close();
            } else {
                NdefFormatable ndefFormatable = NdefFormatable.get(tag);
                if (ndefFormatable != null) {
                    try {
                        ndefFormatable.connect();
                        NdefRecord[] records = {createRecord(tag.getId().toString()) };
                        NdefMessage message = new NdefMessage(records);
                        ndefFormatable.format(message);
                    } catch (FormatException e) {
                        e.printStackTrace();
                    } catch (UnsupportedEncodingException e) {
                        e.printStackTrace();
                    } catch (IOException e) {
                        e.printStackTrace();
                    } finally {
                        try {
                            ndefFormatable.close();
                            searchedTech = "android.nfc.tech.NdefFormatable";

                        } catch (Exception e) {}
                    }
                }

            }

            for (String tech : techList) {
                if (searchedTech.equals(tech)) {
                    new NdefReaderTask().execute(tag);
                    break;
                }
            }
        }
    }

    private NdefRecord createRecord(String text) throws UnsupportedEncodingException {
        String lang = "en";
        byte[] textBytes = text.getBytes();
        byte [] langBytes = lang.getBytes("US-ASCII");
        int langLength = langBytes.length;
        int textLength = textBytes.length;
        byte[] payload = new byte[1 + langLength + textLength];

        payload[0] = (byte) langLength;

        System.arraycopy(langBytes, 0, payload, 1, langLength);
        System.arraycopy(textBytes, 0, payload, 1+langLength, textLength);

        NdefRecord recordNFC = new NdefRecord(NdefRecord.TNF_WELL_KNOWN, NdefRecord.RTD_TEXT, new byte[0], payload);

        return recordNFC;
    }

    public static void setupForegroundDispatch(final Activity activity, NfcAdapter adapter) {
        final Intent intent = new Intent(activity.getApplicationContext(), activity.getClass());
        intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);

        final PendingIntent pendingIntent = PendingIntent.getActivity(activity.getApplicationContext(), 0, intent, 0);

        IntentFilter[] filters = new IntentFilter[1];
        String[][] techList = new String[][]{};

        filters[0] = new IntentFilter();
        filters[0].addAction(NfcAdapter.ACTION_NDEF_DISCOVERED);
        filters[0].addCategory(Intent.CATEGORY_DEFAULT);
        try {
            filters[0].addDataType(MIME_TEXT_PLAIN);
        } catch (MalformedMimeTypeException e) {
            throw new RuntimeException("Check your mime type.");
        }

        adapter.enableForegroundDispatch(activity, pendingIntent, filters, techList);
    }

    public static void stopForegroundDispatch(final Activity activity, NfcAdapter adapter) {
        adapter.disableForegroundDispatch(activity);
    }

    //clase interna
    private class NdefReaderTask extends AsyncTask<Tag, Void, String> {
        Boolean isDice = false;
        Boolean isAnswer = false;

        @Override
        protected String doInBackground(Tag... params) {
            Tag tag = params[0];
            Ndef ndef = Ndef.get(tag);

            if(ndef == null){
                return null;
            }

            NdefMessage ndefMessage = ndef.getCachedNdefMessage();
            NdefRecord[] records = ndefMessage.getRecords();

            for(NdefRecord ndefRecord : records) {
                if(ndefRecord.getTnf() == NdefRecord.TNF_WELL_KNOWN && Arrays.equals(ndefRecord.getType(), NdefRecord.RTD_TEXT)) {
                    try {
                        int dado = 0;
                        String text = readText(ndefRecord);
                        String[] text_data = text.split("-");
                        String card_type = text_data[0].replace(" ","");
                        String card_value = text_data[1].replace(" ","");
                        String selected_answer = "";
                        String result_text = "";
                        String question = "";
                        switch(card_type){
                            case "Dado":
                                dado = (int) Math.floor(Math.random()*6+1);
                                isDice = true;
                                isAnswer = false;
                                break;
                            case "Respuesta":
                                selected_answer = card_value;
                                isDice = false;
                                isAnswer = true;
                                break;
                            case "Conocimiento":
                            case "Acción":
                                question = text;
                                isDice = false;
                                isAnswer = false;
                                break;
                        }

                        if(isDice){
                            updateItem("game_data", "dice", String.valueOf(dado));
                            result_text = String.valueOf(dado);
                        }else if(isAnswer && card_type.equals("Respuesta")){
                            updateItem("game_data", "selected_answer", selected_answer);
                            result_text = selected_answer;
                        }else if(card_type.equals("Conocimiento") || card_type.equals("Acción")){
                            updateItem("game_data", "question_type",card_type);
                            updateItem("game_data", "question_code",card_value);
                            result_text = question;
                        }
                        return result_text;

                    } catch (Exception e) {
                        Log.e(TAG, "Unsupported Encoding", e);
                    }
                }
            }

            return null;
        }

        private String readText(NdefRecord record) throws UnsupportedEncodingException {
            byte[] payload = record.getPayload();

            // Get the Text Encoding
            String textEncoding = ((payload[0] & 128) == 0) ? "UTF-8" : "UTF-16";

            // Get the Language Code
            int languageCodeLength = payload[0] & 0063;
            String text = new String(payload, languageCodeLength + 1, payload.length - languageCodeLength - 1, textEncoding);
            return text;
        }

        private void updateItem(String table, String attribute, String itemValue) {
            Intent intent = getIntent();
            Bundle extras = intent.getExtras();
            String gameCode = extras.getString("game_code");

            CognitoCachingCredentialsProvider credentialsProvider = new CognitoCachingCredentialsProvider(
                    getApplicationContext(),
                    "eu-west-1:cb83ee1e-9dd1-4a9d-9d5a-6f915bc1002c",
                    Regions.EU_WEST_1 //
            );
            AmazonDynamoDBClient dbClient = new AmazonDynamoDBClient(credentialsProvider);
            dbClient.setRegion(Region.getRegion(Regions.EU_WEST_1));
            try {
                dbTable = Table.loadTable(dbClient, DYNAMODB_TABLE);
            } catch (Exception e) {
                try {
                    throw new Exception(e.getMessage());
                } catch (Exception exception) {
                    exception.printStackTrace();
                }

            }

            HashMap<String, AttributeValue> key = new HashMap<String, AttributeValue>();
            Map<String, AttributeValue> expressionAttributeValues = new HashMap<String, AttributeValue>();

            key.put("game_code", new AttributeValue().withS(gameCode));

            ReturnValue returnValues;
            UpdateItemRequest updateItemRequest;

            expressionAttributeValues.put(":val1", new AttributeValue().withS(itemValue));

            returnValues = ReturnValue.ALL_NEW;

            updateItemRequest = new UpdateItemRequest()
                    .withTableName(table)
                    .withKey(key)
                    .withUpdateExpression("set " + attribute + " = :val1")
                    .withExpressionAttributeValues(expressionAttributeValues)
                    .withReturnValues(returnValues);

            dbClient.updateItem(updateItemRequest);
        }


        @Override
        protected void onPostExecute(String result){
            if(result != null){
                if(isDice) {
                    int image_src = 0;
                    String result_text = "Has sacado un ";
                    switch (result) {
                        case "1":
                            image_src = R.drawable.dadocara1;
                            break;
                        case "2":
                            image_src = R.drawable.dadocara2;
                            break;
                        case "3":
                            image_src = R.drawable.dadocara3;
                            break;
                        case "4":
                            image_src = R.drawable.dadocara4;
                            break;
                        case "5":
                            image_src = R.drawable.dadocara5;
                            break;
                        case "6":
                            image_src = R.drawable.dadocara6;
                            break;
                    }
                    mTextView.setText(result_text + result);
                    imageView.setVisibility(View.VISIBLE);
                    imageView.setImageResource(image_src);
                }else if(isAnswer){
                    mTextView.setText("¡Perfecto! Se ha registrado la respuesta " + result + ". Si has cambiado de opinión, simplemente acerca la tarjeta correspondiente a la nueva respuesta, en caso contrario, dile a Alexa que ya has respondido.");
                    imageView.setVisibility(View.INVISIBLE);
                }else{
                    mTextView.setText("De acuerdo, dile a Alexa que te lea la pregunta. ¡Suerte!.");
                    imageView.setVisibility(View.INVISIBLE);
                }
            }else{
                mTextView.setText("Acerque de nuevo la tarjeta");
            }
        }
    }

}