package com.example.saveplanet;

import androidx.annotation.NonNull;
import androidx.appcompat.app.ActionBar;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import android.Manifest;
import android.content.DialogInterface;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.nfc.Tag;
import android.os.AsyncTask;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.MenuItem;
import android.view.View;
import android.widget.Toast;

import com.amazonaws.auth.CognitoCachingCredentialsProvider;
import com.amazonaws.mobileconnectors.dynamodbv2.document.Table;
import com.amazonaws.regions.Region;
import com.amazonaws.regions.Regions;
import com.amazonaws.services.dynamodbv2.AmazonDynamoDBClient;
import com.amazonaws.services.dynamodbv2.model.AttributeValue;
import com.amazonaws.services.dynamodbv2.model.ReturnValue;
import com.amazonaws.services.dynamodbv2.model.UpdateItemRequest;

import com.google.zxing.Result;

import java.util.HashMap;
import java.util.Map;

import me.dm7.barcodescanner.zxing.ZXingScannerView;
import static android.Manifest.permission.CAMERA;

public class MainActivityQR extends AppCompatActivity implements ZXingScannerView.ResultHandler {

    private static final int REQUEST_CAMERA = 1;
    private ZXingScannerView scannerView;
    private final String DYNAMODB_TABLE = "game_data";
    Table dbTable;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        scannerView = new ZXingScannerView(this);
        setContentView(scannerView);

        ActionBar actionBar = getSupportActionBar();
        actionBar.setDisplayHomeAsUpEnabled(true);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            if (checkPermission()) {
                Toast.makeText(MainActivityQR.this, "Permiso concedido!", Toast.LENGTH_LONG).show();
            } else {
                requestPermission();
            }
        }
    }

    @Override
    public boolean onOptionsItemSelected(@NonNull MenuItem item) {
        switch (item.getItemId()) {
            case android.R.id.home:
                this.finish();
                return true;
        }
        return super.onOptionsItemSelected(item);
    }

    private boolean checkPermission() {
        return (ContextCompat.checkSelfPermission(MainActivityQR.this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED);
    }

    private void requestPermission() {
        ActivityCompat.requestPermissions(this, new String[]{CAMERA}, REQUEST_CAMERA);
    }

    public void onRequestPermissionsResult(int requestCode, String permissions[], int[] grantResults) {
        switch (requestCode) {
            case REQUEST_CAMERA:
                if (grantResults.length > 0) {
                    boolean cameraAccepted = grantResults[0] == PackageManager.PERMISSION_GRANTED;
                    if (cameraAccepted) {
                        Toast.makeText(MainActivityQR.this, "Permiso concedido", Toast.LENGTH_LONG).show();
                    } else {
                        Toast.makeText(MainActivityQR.this, "Permiso denegado", Toast.LENGTH_LONG).show();
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            if (shouldShowRequestPermissionRationale(CAMERA)) {
                                displayAlertMessage("Es necesario permitir el acceso a la cámara.",
                                        new DialogInterface.OnClickListener() {
                                            @Override
                                            public void onClick(DialogInterface dialogInterface, int i) {
                                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                                    requestPermissions(new String[]{CAMERA}, REQUEST_CAMERA);
                                                }
                                            }
                                        });
                                return;
                            }
                        }
                    }
                }
                break;
        }
    }

    @Override
    public void onResume() {
        super.onResume();

        int currentapiVersion = android.os.Build.VERSION.SDK_INT;
        if (currentapiVersion >= android.os.Build.VERSION_CODES.M) {
            if (checkPermission()) {
                if (scannerView == null) {
                    scannerView = new ZXingScannerView(this);
                    setContentView(scannerView);
                }
                scannerView.setResultHandler(this);
                scannerView.startCamera();
            } else {
                requestPermission();
            }
        }
    }

    @Override
    public void onDestroy() {
        super.onDestroy();
        scannerView.stopCamera();
    }

    public void displayAlertMessage(String message, DialogInterface.OnClickListener listener) {
        new AlertDialog.Builder(MainActivityQR.this)
                .setMessage(message)
                .setPositiveButton("OK", listener)
                .setNegativeButton("Cancel", null)
                .create()
                .show();
    }

    @Override
    public void handleResult(Result result) {
        new MainActivityQR.QRReaderTask().execute(result.getText());
    }

    private class QRReaderTask extends AsyncTask<String, Void, String> {
        @Override
        protected String doInBackground(String... strings) {
            String result = strings[0];
            if (result.contains("misión 1")) {
                updateItem("game_data", "mission_card", "0");
            } else if (result.contains("misión 2")) {
                updateItem("game_data", "mission_card", "1");
            } else if (result.contains("misión 3")) {
                updateItem("game_data", "mission_card", "2");
            } else if (result.contains("misión 4")) {
                updateItem("game_data", "mission_card", "3");
            } else if (result.contains("misión 5")) {
                updateItem("game_data", "mission_card", "4");
            } else if (result.contains("misión 6")) {
                updateItem("game_data", "mission_card", "5");
            }

            return result;
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
            AlertDialog.Builder builder = new AlertDialog.Builder(MainActivityQR.this);
            builder.setTitle("Resultado del escaneo ");
            builder.setNeutralButton("OK", new DialogInterface.OnClickListener() {

                @Override
                public void onClick(DialogInterface dialogInterface, int i) {
                    scannerView.resumeCameraPreview(MainActivityQR.this);
                }
            });

            builder.setMessage(result);
            AlertDialog alert = builder.create();
            alert.show();
        }

    }
}