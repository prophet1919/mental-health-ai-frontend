<template>
    <el-form>
        <template v-for="item in props.formItem">
            <el-form-item :label="item.label" :prop="item.prop">
                <component :is="isComp(item.comp)" v-model="item.value" :placeholder="item.placeholder" />
            </el-form-item>
        </template>
        
    </el-form>
</template>

<script setup>
const props = defineProps({
    formItem: {
        type: Array,
        default: () => []
    }
})
const isComp = (comp) => {
    return comp === 'input' || comp === 'select'
}
</script>
