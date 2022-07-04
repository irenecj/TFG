package com.example.saveplanet;

import android.content.Intent;
import android.os.AsyncTask;
import android.os.Bundle;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.amazonaws.auth.CognitoCachingCredentialsProvider;
import com.amazonaws.mobileconnectors.dynamodbv2.document.Table;
import com.amazonaws.regions.Region;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClient;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.GetItemRequest;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;

import java.util.HashMap;
import java.util.Map;

public class MainActivity extends AppCompatActivity {
    Button lectorQR;
    Button lectorNFC;
    EditText gameCode;
    TextView gameCodeError;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        gameCode = (EditText)findViewById(R.id.enterGameCode);
        gameCodeError = (TextView)findViewById(R.id.gameCodeError);
        lectorQR = (Button)findViewById(R.id.buttonQR);
        lectorNFC = (Button)findViewById(R.id.buttonNFC);

        lectorQR.setOnClickListener(new View.OnClickListener(){
            @Override
            public void onClick(View v) {
                if(gameCode.getText().toString().matches("")){
                    gameCodeError.setText("Por favor, introduce un código para continuar.");
                }else{
                    new MainActivity.MainActivityTask().execute("MainActivityQR");
                }

            }
        });

        lectorNFC.setOnClickListener(new View.OnClickListener(){
            @Override
            public void onClick(View v) {
                if(gameCode.getText().toString().matches("")) {
                    gameCodeError.setText("Por favor, introduce un código para continuar.");
                }else{
                    new MainActivity.MainActivityTask().execute("MainActivityNFC");
                }
            }
        });
    }

    private class MainActivityTask extends AsyncTask<String, Void, String> {
        @Override
        protected String doInBackground(String... strings) {
          String data[] = new String[2];
          data[0] = strings[0];
          String game_code = gameCode.getText().toString().toUpperCase();
          data[1] = getGameCode(game_code);
          String result = data[0]+","+data[1];
          return result;
        }

        private String getGameCode(String gameCode) {
            Table dbTable;
            CognitoCachingCredentialsProvider credentialsProvider = new CognitoCachingCredentialsProvider(
                    getApplicationContext(),
                    "eu-west-1:cb83ee1e-9dd1-4a9d-9d5a-6f915bc1002c",
                    Regions.EU_WEST_1 //
            );
            AmazonDynamoDBClient dbClient = new AmazonDynamoDBClient(credentialsProvider);
            dbClient.setRegion(Region.getRegion(Regions.EU_WEST_1));
            try {
                dbTable = Table.loadTable(dbClient, "game_data");
            } catch (Exception e) {
                try {
                    throw new Exception(e.getMessage());
                } catch (Exception exception) {
                    exception.printStackTrace();
                }

            }

            HashMap<String, AttributeValue> key = new HashMap<String, AttributeValue>();

            key.put("game_code", new AttributeValue().withS(gameCode));

            ReturnValue returnValues;
            GetItemRequest getItemRequest;

            returnValues = ReturnValue.ALL_NEW;

            getItemRequest = new GetItemRequest()
                    .withTableName("game_data")
                    .withKey(key);

            Map<String,AttributeValue> returned_item = dbClient.getItem(getItemRequest).getItem();
            if (returned_item != null) {
                return "true";
            }else{
                return "false";
            }
        }

        @Override
        protected void onPostExecute(String result){
            String[] result_elements = result.split(",");

            if(result_elements[1].equals("true")){
                if(result_elements[0].equals("MainActivityQR")){
                    gameCodeError.setText("");
                    Intent lectorQR = new Intent(MainActivity.this, MainActivityQR.class);
                    lectorQR.putExtra("game_code", gameCode.getText().toString());
                    startActivity(lectorQR);
                }else{
                    gameCodeError.setText("");
                    Intent lectorNFC = new Intent(MainActivity.this, MainActivityNFC.class);
                    lectorNFC.putExtra("game_code", gameCode.getText().toString());
                    startActivity(lectorNFC);
                }

            }else{
                gameCodeError.setText("Lo sentimos, no hay ninguna partida con ese código.");
            }
        }

    }
}