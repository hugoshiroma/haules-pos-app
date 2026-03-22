package com.hshiroma1.haulesposapp.plugpagclassic

import android.bluetooth.BluetoothAdapter
import android.os.Build
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.module.annotations.ReactModule
import java.util.concurrent.Callable
import java.util.concurrent.Executors

import br.com.uol.pagseguro.plugpag.PlugPag
import br.com.uol.pagseguro.plugpag.PlugPagAppIdentification
import br.com.uol.pagseguro.plugpag.PlugPagDevice
import br.com.uol.pagseguro.plugpag.PlugPagPaymentData

@ReactModule(name = PlugPagClassicModule.NAME)
class PlugPagClassicModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    companion object {
        const val NAME = "PlugPagClassic"
        private val DEVICE_PREFIXES = arrayOf("PRO-", "W-", "W+-", "PLUS-", "MCHIP-")
    }

    override fun getName(): String = NAME

    private fun buildPlugPag(): PlugPag {
        val appName = reactContext.applicationInfo.loadLabel(reactContext.packageManager).toString()
        val appVersion = reactContext.packageManager.getPackageInfo(reactContext.packageName, 0).versionName ?: "1.0.0"
        return PlugPag(reactContext, PlugPagAppIdentification(appName, appVersion))
    }

    @ReactMethod
    fun activateTerminal(activationCode: String, deviceName: String?, promise: Promise) {
        val executor = Executors.newSingleThreadExecutor()
        executor.submit(Callable {
            try {
                val plugPag = buildPlugPag()

                val resolvedDeviceName = deviceName ?: findPairedDeviceName()
                if (resolvedDeviceName.isNullOrBlank()) {
                    promise.reject("NO_DEVICE", "Nenhuma maquininha pareada encontrada. Pareie via Bluetooth e tente novamente.")
                    return@Callable null
                }

                // No BT SDK, "ativar" é estabelecer a conexão. initializeAndActivatePinpad
                // só existe no PlugPagServiceWrapper (on-terminal), não no BT SDK.
                val initResult = plugPag.initBTConnection(PlugPagDevice(resolvedDeviceName))
                val map = Arguments.createMap()
                map.putInt("result", initResult.result)
                map.putString("errorCode", initResult.errorCode)
                map.putString("message", initResult.message)
                promise.resolve(map)
            } catch (error: Throwable) {
                Log.e(NAME, "activateTerminal error", error)
                promise.reject("ACTIVATE_ERROR", error)
            } finally {
                executor.shutdown()
            }
            null
        })
    }

    @ReactMethod
    fun doPaymentClassic(data: com.facebook.react.bridge.ReadableMap, promise: Promise) {
        val executor = Executors.newSingleThreadExecutor()
        executor.submit(Callable {
            try {
                val plugPag = buildPlugPag()

                val deviceName = if (data.hasKey("deviceName")) data.getString("deviceName") else null
                val resolvedDeviceName = deviceName ?: findPairedDeviceName()
                if (resolvedDeviceName.isNullOrBlank()) {
                    promise.reject("NO_DEVICE", "Nenhuma maquininha pareada encontrada. Pare via Bluetooth e tente novamente.")
                    return@Callable null
                }

                val paymentType = data.getInt("type")
                val amount = data.getInt("amount")
                val installmentType = data.getInt("installmentType")
                val installments = data.getInt("installments")
                val userReference = if (data.hasKey("userReference")) data.getString("userReference") else null

                val paymentData = PlugPagPaymentData.Builder()
                    .setType(paymentType)
                    .setAmount(amount)
                    .setInstallmentType(installmentType)
                    .setInstallments(installments)
                    .setUserReference(userReference ?: "")
                    .build()

                val initResult = plugPag.initBTConnection(PlugPagDevice(resolvedDeviceName))
                if (initResult.result != PlugPag.RET_OK) {
                    val map = Arguments.createMap()
                    map.putInt("result", initResult.result)
                    map.putString("errorCode", initResult.errorCode)
                    map.putString("message", initResult.message)
                    promise.resolve(map)
                    return@Callable null
                }

                val transactionResult = plugPag.doPayment(paymentData)
                val map = Arguments.createMap()
                map.putInt("result", transactionResult.result)
                map.putString("errorCode", transactionResult.errorCode)
                map.putString("message", transactionResult.message)
                map.putString("transactionCode", transactionResult.transactionCode)
                map.putString("transactionId", transactionResult.transactionId)
                map.putString("hostNsu", transactionResult.hostNsu)
                map.putString("date", transactionResult.date)
                map.putString("time", transactionResult.time)
                map.putString("cardBrand", transactionResult.cardBrand)
                map.putString("bin", transactionResult.bin)
                map.putString("holder", transactionResult.holder)
                map.putString("userReference", transactionResult.userReference)
                map.putString("terminalSerialNumber", transactionResult.terminalSerialNumber)
                map.putString("amount", transactionResult.amount)
                map.putString("availableBalance", transactionResult.availableBalance)
                // map.putString("cardApplication", transactionResult.cardApplication)
                // map.putString("label", transactionResult.label)
                // map.putString("holderName", transactionResult.holderName)
                // map.putString("extendedHolderName", transactionResult.extendedHolderName)

                promise.resolve(map)
            } catch (error: Throwable) {
                Log.e(NAME, "doPaymentClassic error", error)
                promise.reject("DO_PAYMENT_ERROR", error)
            } finally {
                executor.shutdown()
            }
            null
        })
    }

    private fun findPairedDeviceName(): String? {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return null
        val bonded = adapter.bondedDevices ?: return null
        for (device in bonded) {
            val name = device.name ?: continue
            if (DEVICE_PREFIXES.any { prefix -> name.startsWith(prefix) }) {
                return name
            }
        }
        return null
    }
}
